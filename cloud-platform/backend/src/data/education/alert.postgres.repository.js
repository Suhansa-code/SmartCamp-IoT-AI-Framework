/**
 * PostgreSQL alert repository — writes education domain data to the cloud
 * database. Used by seed.js and alertSync.service when DB_ENABLED=true.
 */
import { getPool } from '../../config/database.js';

export async function getAlerts(status = null, camp = null) {
  const conditions = [];
  const values = [];
  if (status) { values.push(status); conditions.push(`status = $${values.length}`); }
  if (camp) { values.push(camp); conditions.push(`camp_id = $${values.length}`); }
  const result = await getPool().query(`SELECT * FROM alerts ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY triggered_at DESC`, values);
  return result.rows;
}

export async function getAlert(alertId) {
  const result = await getPool().query('SELECT * FROM alerts WHERE alert_id = $1', [alertId]);
  return result.rows[0] || null;
}

export async function resolveAlert(alertId, notes = null) {
  const result = await getPool().query('UPDATE alerts SET status = $1, resolved_at = NOW(), resolved_notes = $2 WHERE alert_id = $3 RETURNING alert_id', ['resolved', notes, alertId]);
  return result.rowCount > 0;
}

export async function getCampSummaries() {
  const result = await getPool().query(`
    SELECT c.camp_id AS id, COUNT(DISTINCT c.child_id)::int AS children,
      COUNT(DISTINCT s.session_id)::int AS sessions,
      COALESCE(ROUND(AVG(s.composite_score)), 0)::int AS avg_composite,
      COUNT(DISTINCT a.alert_id)::int AS total_alerts,
      COUNT(DISTINCT a.alert_id) FILTER (WHERE a.status = 'pending')::int AS pending_alerts,
      COUNT(DISTINCT bs.signal_id)::int AS total_signals,
      ROUND(AVG(bs.accuracy_rate)::numeric, 1)::real AS avg_accuracy,
      ROUND(AVG(bs.avg_reaction_time)::numeric, 1)::real AS avg_reaction_ms,
      ROUND(AVG(bs.completion_ratio)::numeric, 2)::real AS avg_completion,
      COUNT(DISTINCT cr.response_id)::int AS total_responses,
      ROUND(AVG(cr.is_correct)::numeric * 100, 1)::real AS content_accuracy_pct
    FROM children c
    LEFT JOIN sessions s ON s.child_id = c.child_id
    LEFT JOIN alerts a ON a.camp_id = c.camp_id
    LEFT JOIN pages_behavioral_signals bs ON bs.child_id = c.child_id
    LEFT JOIN pages_content_responses cr ON cr.child_id = c.child_id
    GROUP BY c.camp_id ORDER BY c.camp_id
  `);
  return result.rows;
}

export async function getCampEducation(campId) {
  const [childrenResult, sessionsResult, alertsResult, signalsResult, responsesResult, decisionsResult] = await Promise.all([
    getPool().query('SELECT * FROM children WHERE camp_id = $1 ORDER BY child_id', [campId]),
    getPool().query('SELECT s.* FROM sessions s JOIN children c ON c.child_id = s.child_id WHERE c.camp_id = $1 ORDER BY s.created_at DESC', [campId]),
    getPool().query('SELECT * FROM alerts WHERE camp_id = $1 ORDER BY triggered_at DESC', [campId]),
    getPool().query(`SELECT bs.* FROM pages_behavioral_signals bs JOIN children c ON c.child_id = bs.child_id WHERE c.camp_id = $1 ORDER BY bs.session_id`, [campId]),
    getPool().query(`SELECT cr.* FROM pages_content_responses cr JOIN children c ON c.child_id = cr.child_id WHERE c.camp_id = $1 ORDER BY cr.responded_at DESC`, [campId]),
    getPool().query(`SELECT pg.* FROM pages_gate_decisions pg JOIN children c ON c.child_id = pg.child_id WHERE c.camp_id = $1 ORDER BY pg.decided_at DESC`, [campId]),
  ]);
  if (!childrenResult.rows.length) return null;
  const scores = sessionsResult.rows.map((session) => session.composite_score).filter((score) => score != null);

  const signals = signalsResult.rows;
  const responses = responsesResult.rows;
  const decisions = decisionsResult.rows;

  const avgAccuracy = signals.length ? Math.round(signals.reduce((s, r) => s + (Number(r.accuracy_rate) || 0), 0) / signals.length * 10) / 10 : null;
  const avgReaction = signals.length ? Math.round(signals.reduce((s, r) => s + (Number(r.avg_reaction_time) || 0), 0) / signals.length * 10) / 10 : null;
  const avgCompletion = signals.length ? Math.round(signals.reduce((s, r) => s + (Number(r.completion_ratio) || 0), 0) / signals.length * 100) / 100 : null;
  const avgFalseTap = signals.length ? Math.round(signals.reduce((s, r) => s + (Number(r.false_tap_rate) || 0), 0) / signals.length * 100) / 100 : null;
  const totalRapidClicks = signals.reduce((s, r) => s + (Number(r.rapid_click_count) || 0), 0);
  const contentCorrect = responses.filter((r) => r.is_correct === 1).length;
  const contentAccuracy = responses.length ? Math.round((contentCorrect / responses.length) * 1000) / 10 : null;

  const gradeMap = new Map();
  const langMap = new Map();
  childrenResult.rows.forEach((child) => {
    const g = child.grade || 'unknown';
    gradeMap.set(g, (gradeMap.get(g) || 0) + 1);
    const l = child.language || 'unknown';
    langMap.set(l, (langMap.get(l) || 0) + 1);
  });

  // Pre-build sessions-by-child map to avoid O(C×S) nested filter
  const sessionsByChild = new Map();
  for (const session of sessionsResult.rows) {
    const list = sessionsByChild.get(session.child_id);
    if (list) {
      list.push(session);
    } else {
      sessionsByChild.set(session.child_id, [session]);
    }
  }

  return {
    id: campId, children_count: childrenResult.rows.length, sessions_count: sessionsResult.rows.length,
    avg_composite: scores.length ? Math.round(scores.reduce((sum, score) => sum + Number(score), 0) / scores.length) : 0,
    pending_alerts: alertsResult.rows.filter((alert) => alert.status === 'pending').length,
    children: childrenResult.rows.map((child) => ({ ...child, recent_scores: (sessionsByChild.get(child.child_id) || []).slice(0, 5) })),
    sessions: sessionsResult.rows,
    alerts: alertsResult.rows,
    behavioral_signals: signals,
    gate_decisions_list: decisions,
    grade_distribution: Array.from(gradeMap.entries()).map(([grade, count]) => ({ grade, count })),
    language_distribution: Array.from(langMap.entries()).map(([language, count]) => ({ language, count })),
    behavioral: { avg_accuracy: avgAccuracy, avg_reaction_ms: avgReaction, avg_completion: avgCompletion, avg_false_tap: avgFalseTap, total_rapid_clicks: totalRapidClicks, signal_count: signals.length },
    content: { total_responses: responses.length, correct: contentCorrect, accuracy_pct: contentAccuracy },
    gate_decisions: decisions.length,
  };
}

export async function syncChildren(childList) {
  const pool = getPool();
  let count = 0;
  for (const child of childList) {
    if (!child.child_id) continue;
    await pool.query(
      `INSERT INTO children (child_id, res_id, camp_id, grade, language, baseline_score, total_sessions, alert_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (child_id) DO UPDATE SET
         res_id = EXCLUDED.res_id,
         camp_id = EXCLUDED.camp_id,
         grade = EXCLUDED.grade,
         language = EXCLUDED.language,
         baseline_score = EXCLUDED.baseline_score,
         total_sessions = EXCLUDED.total_sessions,
         alert_status = EXCLUDED.alert_status`,
      [child.child_id, child.res_id || null, child.camp_id || null, child.grade || null, child.language || null, child.baseline_score || null, child.total_sessions || 0, child.alert_status || 'normal'],
    );
    count++;
  }
  return count;
}

export async function syncSessions(sessionList) {
  const pool = getPool();
  let count = 0;
  for (const session of sessionList) {
    if (!session.session_id) continue;
    await pool.query(
      `INSERT INTO sessions (session_id, child_id, composite_score, anomaly_flagged, alert_triggered, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (session_id) DO UPDATE SET
         child_id = EXCLUDED.child_id,
         composite_score = EXCLUDED.composite_score,
         anomaly_flagged = EXCLUDED.anomaly_flagged,
         alert_triggered = EXCLUDED.alert_triggered,
         created_at = EXCLUDED.created_at`,
      [
        session.session_id,
        session.child_id || null,
        session.composite_score || null,
        session.anomaly_flagged ? 1 : 0,
        session.alert_triggered ? 1 : 0,
        session.created_at || new Date().toISOString(),
      ],
    );
    count++;
  }
  return count;
}

export async function upsertAlert({ alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at }) {
  const pool = getPool();
  if (!alert_id || !child_id || !camp_id) {
    return { success: false, alert_id: null, error: 'Missing required fields' };
  }

  await pool.query(
    `INSERT INTO alerts (alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     ON CONFLICT (alert_id) DO UPDATE SET
       child_id = EXCLUDED.child_id,
       res_id = EXCLUDED.res_id,
       camp_id = EXCLUDED.camp_id,
       alert_type = EXCLUDED.alert_type,
       trigger_detail = EXCLUDED.trigger_detail,
       triggered_at = EXCLUDED.triggered_at,
       status = 'pending'`,
    [alert_id, child_id, res_id || null, camp_id, alert_type || 'unknown', JSON.stringify(trigger_detail || {}), triggered_at || new Date().toISOString()],
  );

  return { success: true, alert_id };
}

export async function syncCamps(campList) {
  const pool = getPool();
  let count = 0;
  for (const camp of campList) {
    if (!camp.id) continue;
    await pool.query(
      `INSERT INTO "CAMPS" (id, code, name, lat, lng, status, displaced, capacity, aid, type, workers,
        water_path, river, station, st_dist, up_dist, wl, rain, alert_l, minor_l, major_l,
        gau_lat, gau_lng, fc_lat, fc_lng, elev, min_t, max_t, hum, precip, max_hr_prec,
        max_wind, avg_wind, soil, pres, cloud)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
       ON CONFLICT (id) DO UPDATE SET
         code = EXCLUDED.code, name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
         status = EXCLUDED.status, displaced = EXCLUDED.displaced, capacity = EXCLUDED.capacity,
         aid = EXCLUDED.aid, type = EXCLUDED.type, workers = EXCLUDED.workers,
         water_path = EXCLUDED.water_path, river = EXCLUDED.river, station = EXCLUDED.station,
         st_dist = EXCLUDED.st_dist, up_dist = EXCLUDED.up_dist, wl = EXCLUDED.wl,
         rain = EXCLUDED.rain, alert_l = EXCLUDED.alert_l, minor_l = EXCLUDED.minor_l,
         major_l = EXCLUDED.major_l, gau_lat = EXCLUDED.gau_lat, gau_lng = EXCLUDED.gau_lng,
         fc_lat = EXCLUDED.fc_lat, fc_lng = EXCLUDED.fc_lng, elev = EXCLUDED.elev,
         min_t = EXCLUDED.min_t, max_t = EXCLUDED.max_t, hum = EXCLUDED.hum,
         precip = EXCLUDED.precip, max_hr_prec = EXCLUDED.max_hr_prec,
         max_wind = EXCLUDED.max_wind, avg_wind = EXCLUDED.avg_wind,
         soil = EXCLUDED.soil, pres = EXCLUDED.pres, cloud = EXCLUDED.cloud`,
      [
        camp.id, camp.code, camp.name, camp.lat, camp.lng, camp.status, camp.displaced,
        camp.capacity, camp.aid, camp.type, camp.workers,
        camp.detail?.waterPath || null, camp.detail?.river || null, camp.detail?.station || null,
        camp.detail?.stDist || null, camp.detail?.upDist || null, camp.detail?.wl || null,
        camp.detail?.rain || null, camp.detail?.alertL || null, camp.detail?.minorL || null,
        camp.detail?.majorL || null, camp.detail?.gauLat || null, camp.detail?.gauLng || null,
        camp.detail?.fcLat || null, camp.detail?.fcLng || null, camp.detail?.elev || null,
        camp.detail?.minT || null, camp.detail?.maxT || null, camp.detail?.hum || null,
        camp.detail?.precip || null, camp.detail?.maxHrPrec || null, camp.detail?.maxWind || null,
        camp.detail?.avgWind || null, camp.detail?.soil || null, camp.detail?.pres || null,
        camp.detail?.cloud || null,
      ],
    );
    count++;
  }
  return count;
}
