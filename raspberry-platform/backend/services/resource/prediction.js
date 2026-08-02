import { campDb as db } from '../../config/database.js';
import * as saamp from '../network/saamp-mqtt.js';

const PREDICTION_URL = process.env.PREDICTION_API_URL;

export function computeInputs() {
  const total = db.prepare('SELECT COUNT(*) as c FROM persons').get().c;
  const children = db.prepare('SELECT COUNT(*) as c FROM persons WHERE age < 18').get().c;
  const elderly = db.prepare('SELECT COUNT(*) as c FROM persons WHERE age >= 60').get().c;
  const female = db.prepare("SELECT COUNT(*) as c FROM persons WHERE gender = 'F'").get().c;
  const pregnant = db.prepare('SELECT COUNT(*) as c FROM persons WHERE is_pregnant = 1').get().c;
  const chronic = db.prepare('SELECT COUNT(*) as c FROM persons WHERE has_chronic_illness = 1').get().c;

  const typeRows = db.prepare('SELECT COALESCE(person_type, \'refugee\') as person_type, COUNT(*) as c FROM persons GROUP BY person_type').all();
  const typeMap = {};
  typeRows.forEach(r => { typeMap[r.person_type] = r.c; });

  const yearlyArrivals = db.prepare(`
    SELECT COUNT(*) as c FROM camp_checkins
    WHERE strftime('%Y', checkin_time) = strftime('%Y', 'now') AND is_new_arrival = 1
  `).get().c;

  const last7 = db.prepare(`
    SELECT COUNT(*) as c FROM camp_checkins
    WHERE checkin_time >= datetime('now', '-7 days') AND is_new_arrival = 1
  `).get().c;
  const dailyArrivalRate = parseFloat((last7 / 7).toFixed(2));

  const lastYearArrivals = db.prepare(`
    SELECT COUNT(*) as c FROM camp_checkins
    WHERE strftime('%Y', checkin_time) = CAST(CAST(strftime('%Y', 'now') AS INTEGER) - 1 AS TEXT) AND is_new_arrival = 1
  `).get().c;
  const arrivalGrowthRate = lastYearArrivals > 0
    ? parseFloat(((yearlyArrivals - lastYearArrivals) / lastYearArrivals).toFixed(4)) : 0.0;

  const safe = (n, d) => total > 0 ? parseFloat((n / total).toFixed(4)) : d;

  return {
    total_population: total, refugees: typeMap['refugee'] || 0, asylum_seekers: typeMap['asylum_seeker'] || 0,
    idps: typeMap['idp'] || 0, returned_refugees: typeMap['returned_refugee'] || 0,
    returned_idps: typeMap['returned_idp'] || 0, stateless: typeMap['stateless'] || 0,
    ooc: typeMap['ooc'] || 0, children_ratio: safe(children, 0.40), elderly_ratio: safe(elderly, 0.05),
    female_ratio: safe(female, 0.49), yearly_arrivals: yearlyArrivals,
    arrival_growth_rate: arrivalGrowthRate, year: new Date().getFullYear(),
    daily_arrival_rate: dailyArrivalRate, pregnant, chronic_illness: chronic,
  };
}

function buildDayForecasts(base, days) {
  const today = new Date();
  const dayForecasts = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const projPop = Math.max(1, Math.round(base.total_population + base.daily_arrival_rate * i));
    const scale = base.total_population > 0 ? projPop / base.total_population : 1;

    dayForecasts.push({
      date: date.toISOString().split('T')[0], day_offset: i,
      inputs: {
        total_population: projPop, refugees: Math.round(base.refugees * scale),
        asylum_seekers: Math.round(base.asylum_seekers * scale), idps: Math.round(base.idps * scale),
        returned_refugees: Math.round(base.returned_refugees * scale),
        returned_idps: Math.round(base.returned_idps * scale), stateless: Math.round(base.stateless * scale),
        ooc: Math.round(base.ooc * scale), children_ratio: base.children_ratio,
        elderly_ratio: base.elderly_ratio, female_ratio: base.female_ratio,
        yearly_arrivals: Math.round(base.yearly_arrivals + base.daily_arrival_rate * i),
        arrival_growth_rate: base.arrival_growth_rate, year: date.getFullYear(),
      },
    });
  }
  return dayForecasts;
}

export async function getForecast(days) {
  const base = computeInputs();
  const dayForecasts = buildDayForecasts(base, days);

  const { lastInsertRowid: requestId } = db.prepare(
    'INSERT INTO prediction_requests (inputs, status) VALUES (?, \'pending\')'
  ).run(JSON.stringify({ type: 'forecast', days, base_inputs: base }));

  const networkState = saamp.getNetworkState();

  if (PREDICTION_URL && networkState !== 'CRITICAL') {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const httpRes = await fetch(`${PREDICTION_URL}/predict/batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dayForecasts.map(d => d.inputs)), signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (httpRes.ok) {
        const predictions = await httpRes.json();
        const forecasts = dayForecasts.map((d, i) => ({
          date: d.date, day_offset: d.day_offset,
          projected_population: d.inputs.total_population, result: predictions[i],
        }));
        db.prepare('UPDATE prediction_requests SET status=\'complete\', result=?, sent_at=datetime(\'now\') WHERE id=?')
          .run(JSON.stringify({ type: 'forecast', forecasts }), requestId);
        return { request_id: requestId, status: 'complete', forecasts };
      }
    } catch (_) {}

    try {
      const forecasts = [];
      for (const day of dayForecasts) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const httpRes = await fetch(`${PREDICTION_URL}/predict`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(day.inputs), signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!httpRes.ok) throw new Error('non-200');
        const result = await httpRes.json();
        forecasts.push({ date: day.date, day_offset: day.day_offset, projected_population: day.inputs.total_population, result });
      }
      db.prepare('UPDATE prediction_requests SET status=\'complete\', result=?, sent_at=datetime(\'now\') WHERE id=?')
        .run(JSON.stringify({ type: 'forecast', forecasts }), requestId);
      return { request_id: requestId, status: 'complete', forecasts };
    } catch (e) {
      console.log('[Prediction] HTTP forecast failed, falling back to MQTT:', e.message);
    }
  }

  const mqttMeta = saamp.publish(
    'smartcamp/prediction/forecast_request',
    { request_id: requestId, days: dayForecasts, timestamp: new Date().toISOString() },
    'prediction_model', 'daily_forecast'
  );
  const status = mqttMeta.published ? 'sent' : 'buffered';
  db.prepare('UPDATE prediction_requests SET status=?, sent_at=datetime(\'now\') WHERE id=?').run(status, requestId);

  return {
    request_id: requestId, status, mqtt: mqttMeta,
    forecasts: dayForecasts.map(d => ({ date: d.date, day_offset: d.day_offset, projected_population: d.inputs.total_population, result: null })),
    message: status === 'buffered' ? 'Forecast buffered — will sync when network recovers' : 'Forecast sent via MQTT — awaiting result from cloud',
  };
}

export function getLatestResult() {
  const row = db.prepare('SELECT id, inputs, result, status, created_at, sent_at FROM prediction_requests ORDER BY id DESC LIMIT 1').get();
  if (!row) return { result: null, status: 'none' };
  const parsed = row.result ? JSON.parse(row.result) : null;
  return { request_id: row.id, status: row.status, forecasts: parsed?.forecasts ?? null, created_at: row.created_at, sent_at: row.sent_at };
}

export function saveResult(requestId, forecasts, result) {
  const payload = forecasts ? { type: 'forecast', forecasts } : result;
  const changes = db.prepare('UPDATE prediction_requests SET status=\'complete\', result=? WHERE id=?').run(JSON.stringify(payload), requestId).changes;
  return changes > 0;
}

export function setupMqttListener() {
  saamp.onMessage('smartcamp/prediction/forecast_result', (payload) => {
    const { request_id, forecasts } = payload;
    if (!request_id || !forecasts) return;
    db.prepare('UPDATE prediction_requests SET status = \'complete\', result = ? WHERE id = ?')
      .run(JSON.stringify({ type: 'forecast', forecasts }), request_id);
  });
}
