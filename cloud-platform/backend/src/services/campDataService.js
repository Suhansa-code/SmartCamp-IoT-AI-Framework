// CampDataService — Cloud-side EMQX subscriber.
// Subscribes to smartcamp/# and maintains a live in-memory picture of the camp.
// All data arrives via the Pi → EMQX broker → this service.
//
// Topics consumed:
//   smartcamp/registration/new      — new person registered
//   smartcamp/registration/checkin  — person check-in
//   smartcamp/distribution/log      — meal / water distribution

import mqtt   from 'mqtt';
import fs     from 'fs';
import path   from 'path';
import { fileURLToPath } from 'url';
import { computePrediction } from './predictionService.js';
import {
  upsertPerson,
  recordDistribution,
  upsertDailySnapshot,
  logMqttEvent,
  loadCampState,
} from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EMQX_HOST     = process.env.EMQX_HOST     || 'i17140d1.ala.asia-southeast1.emqxsl.com';
const EMQX_PORT     = parseInt(process.env.EMQX_PORT || '8883', 10);
const EMQX_USERNAME = process.env.EMQX_USERNAME || 'admin';
const EMQX_PASSWORD = process.env.EMQX_PASSWORD || 'public';
const CA_CERT_PATH  = process.env.EMQX_CA_CERT  || path.join(__dirname, '../../emqxsl-ca.crt');

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'water'];

// ── helpers ────────────────────────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function freshDayCounters() {
  return {
    date:             todayDate(),
    new_registrations: 0,
    checkin_ids:      new Set(),   // person_ids who checked in today
    distributions:    { breakfast: 0, lunch: 0, dinner: 0, water: 0 },
  };
}

// ── In-memory store ────────────────────────────────────────────────────────

const store = {
  persons:          new Map(),   // person_id  → person object
  wristbandPerson:  new Map(),   // barcode    → person object
  distributions:    new Set(),   // "barcode:type:YYYY-MM-DD"
  events:           [],          // last 100 events, newest first
  dailySnapshots:   [],          // [{date, total_persons, new_registrations, checkins, attendance_rate, distributions}]
  day:              freshDayCounters(),
  lastUpdated:      null,
  mqttConnected:    false,
};

// Save a snapshot of the previous day and reset today's counters.
function rolloverDay() {
  const { date, new_registrations, checkin_ids, distributions } = store.day;
  const total = store.persons.size;
  const checkins = checkin_ids.size;
  const snapshot = {
    date,
    total_persons:      total,
    new_registrations,
    checkins,
    attendance_rate:    total > 0 ? checkins / total : 0,
    distributions:      { ...distributions },
  };
  store.dailySnapshots.push(snapshot);
  if (store.dailySnapshots.length > 30) store.dailySnapshots.shift();
  store.day = freshDayCounters();
  console.log(`[Camp Data] Day rollover: snapshot saved for ${date}`);

  upsertDailySnapshot(snapshot).catch(err =>
    console.error('[Camp Data] Failed to persist daily snapshot:', err.message)
  );
}

// Check if we've crossed midnight since the last event.
function checkDayRollover() {
  const today = todayDate();
  if (store.day.date && store.day.date !== today) {
    rolloverDay();
  }
}

function pushEvent(type, summary, timestamp) {
  store.events.unshift({ type, summary, timestamp: timestamp || new Date().toISOString() });
  if (store.events.length > 100) store.events.pop();
  store.lastUpdated = new Date().toISOString();
}

// ── MQTT message handlers ──────────────────────────────────────────────────

async function onRegistration(payload) {
  checkDayRollover();
  const { person, wristband_barcode } = payload;
  if (!person?.id) return;

  store.persons.set(person.id, { ...person, wristband_barcode });
  if (wristband_barcode) store.wristbandPerson.set(wristband_barcode, { ...person, wristband_barcode });

  store.day.new_registrations++;
  store.day.checkin_ids.add(person.id); // registration counts as present today

  const qosInfo = payload.mqtt ? ` | QoS ${payload.mqtt.final_qos ?? payload.mqtt.base_qos} | ${payload.mqtt.network_state}` : '';
  pushEvent('registration', `${person.full_name} registered · ${wristband_barcode ?? 'no wristband'}${qosInfo}`, payload.timestamp);
  console.log(`[Camp▼] Register: ${person.full_name} (id=${person.id}, wb=${wristband_barcode ?? '—'})`);

  await upsertPerson(person, wristband_barcode);
}

async function onCheckin(payload) {
  checkDayRollover();
  const { person, wristband_barcode } = payload;
  if (!person?.id) return;

  const existing = store.persons.get(person.id) || {};
  const merged   = { ...existing, ...person, wristband_barcode: wristband_barcode ?? existing.wristband_barcode };
  store.persons.set(person.id, merged);
  if (merged.wristband_barcode) store.wristbandPerson.set(merged.wristband_barcode, merged);

  store.day.checkin_ids.add(person.id);

  pushEvent('checkin', `${person.full_name} checked in · ${wristband_barcode ?? merged.wristband_barcode ?? '—'}`, payload.timestamp);
  console.log(`[Camp▼] Checkin: ${person.full_name} (id=${person.id})`);

  await upsertPerson(merged, merged.wristband_barcode);
}

async function onDistribution(payload) {
  checkDayRollover();
  const { barcode, resource_type, person_name, person_id, quantity } = payload;
  if (!barcode || !resource_type) return;

  const key = `${barcode}:${resource_type}:${todayDate()}`;
  const isNew = !store.distributions.has(key);
  store.distributions.add(key);

  // Only count once per barcode+type+day, matching the DB's unique constraint.
  if (isNew && MEAL_TYPES.includes(resource_type)) {
    store.day.distributions[resource_type]++;
  }

  pushEvent('distribution', `${person_name ?? barcode} received ${resource_type}`, payload.timestamp);
  console.log(`[Camp▼] Distribute: ${resource_type} → ${person_name ?? barcode}`);

  await recordDistribution({
    person_id, person_name, barcode, resource_type, quantity,
    distributed_at: payload.timestamp ? new Date(payload.timestamp) : new Date(),
  });
}

// ── Computed overview (called by REST route) ───────────────────────────────

export function getOverview() {
  const persons   = Array.from(store.persons.values());
  const total     = persons.length;
  const pregnant  = persons.filter(p => p.is_pregnant).length;
  const chronic   = persons.filter(p => p.has_chronic_illness).length;
  const families  = new Set(persons.map(p => p.family_unit_id).filter(Boolean)).size;

  // Wristbands = unit of distribution eligibility
  const wristbands       = new Set(persons.filter(p => p.wristband_barcode).map(p => p.wristband_barcode));
  const eligible         = wristbands.size;
  const todayCheckins    = store.day.checkin_ids.size;
  const attendanceRate   = total > 0 ? Math.round((todayCheckins / total) * 100) : 0;

  // Distribution progress for today
  const d = store.day.date;
  const distribution_today = {};
  for (const type of MEAL_TYPES) {
    let served = 0;
    for (const wb of wristbands) {
      if (store.distributions.has(`${wb}:${type}:${d}`)) served++;
    }
    distribution_today[type] = {
      served,
      pending: Math.max(0, eligible - served),
      percent: eligible > 0 ? Math.round((served / eligible) * 100) : 0,
    };
  }

  // Prediction using daily snapshot history
  const prediction_tomorrow = computePrediction({
    snapshots:    store.dailySnapshots,
    totalPersons: total,
    pregnant,
    chronic,
  });

  // Recent registrations (last 10, newest first)
  const recent_registrations = persons
    .filter(p => p.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  // Live event feed (last 20)
  const recent_events = store.events.slice(0, 20);

  return {
    source:       'cloud_mqtt',
    last_updated: store.lastUpdated,
    mqtt: {
      connected:         store.mqttConnected,
      network_state:     store.mqttConnected ? 'STABLE' : 'DISCONNECTED',
      buffered_messages: 0,
    },
    population: {
      total,
      today_registered: store.day.new_registrations,
      today_checkins:   todayCheckins,
      attendance_rate_pct: attendanceRate,
      families,
    },
    vulnerable: {
      pregnant,
      chronic_illness:  chronic,
      total_flagged:    pregnant + chronic,
    },
    eligible_for_distribution: eligible,
    distribution_today,
    prediction_tomorrow,
    recent_registrations,
    recent_events,
  };
}

// ── MQTT connection ────────────────────────────────────────────────────────

// Rebuild the in-memory store from Postgres so a restart doesn't lose today's picture.
async function rehydrateFromDb() {
  try {
    const { persons, todaysDistributions, dailySnapshots } = await loadCampState();

    for (const row of persons) {
      const person = {
        id: row.person_id,
        fingerprint_id: row.fingerprint_id,
        full_name: row.full_name,
        age: row.age,
        gender: row.gender,
        person_type: row.person_type,
        family_unit_id: row.family_unit_id,
        family_size: row.family_size,
        is_pregnant: row.is_pregnant,
        has_chronic_illness: row.has_chronic_illness,
        medical_notes: row.medical_notes,
        pre_registered: row.pre_registered,
        is_active: row.is_active,
        created_at: row.created_at,
        wristband_barcode: row.wristband_barcode,
      };
      store.persons.set(person.id, person);
      if (person.wristband_barcode) store.wristbandPerson.set(person.wristband_barcode, person);
    }

    for (const d of todaysDistributions) {
      const dateStr = d.distributed_date.toISOString().slice(0, 10);
      store.distributions.add(`${d.barcode}:${d.resource_type}:${dateStr}`);
    }

    store.dailySnapshots = dailySnapshots.map(s => ({
      date:               s.snapshot_date.toISOString().slice(0, 10),
      total_persons:      s.total_persons,
      new_registrations:  s.new_registrations,
      checkins:           s.checkins,
      attendance_rate:    s.attendance_rate,
      distributions:      s.distributions,
    }));

    console.log(`[Camp Data] Rehydrated from Postgres: ${persons.length} persons, ${todaysDistributions.length} distributions today, ${dailySnapshots.length} daily snapshots`);
  } catch (err) {
    console.error('[Camp Data] Failed to rehydrate from Postgres:', err.message);
  }
}

export async function startCampDataService() {
  let ca;
  try { ca = fs.readFileSync(CA_CERT_PATH); } catch (_) {}

  await rehydrateFromDb();

  const client = mqtt.connect(`mqtts://${EMQX_HOST}:${EMQX_PORT}`, {
    clientId:        `cloud-admin-${Date.now()}`,
    username:        EMQX_USERNAME,
    password:        EMQX_PASSWORD,
    protocol:        'mqtts',
    clean:           true,
    reconnectPeriod: 3000,
    connectTimeout:  10_000,
    ...(ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }),
  });

  client.on('connect', () => {
    store.mqttConnected = true;
    console.log('[Camp Data] Connected to EMQX broker');
    client.subscribe('smartcamp/#', { qos: 2 }, err => {
      if (err) console.error('[Camp Data] Subscribe failed:', err.message);
      else     console.log('[Camp Data] Subscribed to smartcamp/# (QoS 2)');
    });
  });

  client.on('message', async (topic, buffer) => {
    try {
      const payload = JSON.parse(buffer.toString());
      logMqttEvent(topic, payload); // raw audit log, every topic, fire-and-forget

      if      (topic === 'smartcamp/registration/new')     await onRegistration(payload);
      else if (topic === 'smartcamp/registration/checkin') await onCheckin(payload);
      else if (topic === 'smartcamp/distribution/log')     await onDistribution(payload);
    } catch (e) {
      console.error('[Camp Data] Parse error:', e.message);
    }
  });

  client.on('close',     () => { store.mqttConnected = false; console.log('[Camp Data] Disconnected from EMQX'); });
  client.on('reconnect', () => console.log('[Camp Data] Reconnecting to EMQX...'));
  client.on('error',     err => console.error('[Camp Data] MQTT error:', err.message));

  // Midnight rollover check — every hour
  setInterval(() => {
    if (store.day.date !== todayDate()) rolloverDay();
  }, 60 * 60 * 1000);

  return client;
}
