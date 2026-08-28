/**
 * CampDataService — cloud-side EMQX subscriber for the Resources domain.
 * Subscribes to smartcamp/# and maintains a live in-memory picture of the camp.
 * All data arrives via the Pi → EMQX broker → this service.
 *
 * Topics consumed:
 *   smartcamp/registration/new      — new person registered
 *   smartcamp/registration/checkin  — person check-in
 *   smartcamp/distribution/log      — meal / water distribution
 */
import mqtt from 'mqtt';
import fs from 'fs';
import { env } from '../../config/env.js';
import { computePrediction } from './prediction.service.js';
import { MEAL_TYPES } from '../../data/resources/campData.data.js';
import {
  savePerson, saveSnapshot, loadPersons, loadSnapshots, loadPopulationHistory,
} from './campStore.repository.js';

const { host, port, username, password, caCertPath } = env.emqx;

// ── helpers ────────────────────────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function freshDayCounters() {
  return {
    date: todayDate(),
    new_registrations: 0,
    checkin_ids: new Set(),
    distributions: { breakfast: 0, lunch: 0, dinner: 0, water: 0 },
  };
}

// ── In-memory store ────────────────────────────────────────────────────────

const store = {
  persons: new Map(),
  wristbandPerson: new Map(),
  distributions: new Set(),
  events: [],
  dailySnapshots: [],
  day: freshDayCounters(),
  lastUpdated: null,
  mqttConnected: false,
};

function rolloverDay() {
  const { date, new_registrations, checkin_ids, distributions } = store.day;
  const total = store.persons.size;
  const checkins = checkin_ids.size;
  store.dailySnapshots.push({
    date,
    total_persons: total,
    new_registrations,
    checkins,
    attendance_rate: total > 0 ? checkins / total : 0,
    distributions: { ...distributions },
  });
  if (store.dailySnapshots.length > 30) store.dailySnapshots.shift();
  saveSnapshot({ date, total_persons: total, new_registrations, checkins });
  store.day = freshDayCounters();
  console.log(`[Camp Data] Day rollover: snapshot saved for ${date}`);
}

function checkDayRollover() {
  const today = todayDate();
  if (store.day.date && store.day.date !== today) {
    rolloverDay();
  }
}

/**
 * Write today's running totals to disk. Called after every event so the daily
 * population history survives a restart, not just a clean midnight rollover.
 */
function persistToday() {
  saveSnapshot({
    date: store.day.date,
    total_persons: store.persons.size,
    new_registrations: store.day.new_registrations,
    checkins: store.day.checkin_ids.size,
  });
}

function pushEvent(type, summary, timestamp) {
  store.events.unshift({ type, summary, timestamp: timestamp || new Date().toISOString() });
  if (store.events.length > 100) store.events.pop();
  store.lastUpdated = new Date().toISOString();
}

// ── MQTT message handlers ──────────────────────────────────────────────────

function onRegistration(payload) {
  checkDayRollover();
  const { person, wristband_barcode } = payload;
  if (!person?.id) return;

  store.persons.set(person.id, { ...person, wristband_barcode });
  if (wristband_barcode) store.wristbandPerson.set(wristband_barcode, { ...person, wristband_barcode });

  store.day.new_registrations++;
  store.day.checkin_ids.add(person.id);

  const qosInfo = payload.mqtt
    ? ` | QoS ${payload.mqtt.final_qos ?? payload.mqtt.base_qos} | ${payload.mqtt.network_state}`
    : '';
  savePerson({ ...person, wristband_barcode });
  persistToday();

  pushEvent('registration', `${person.full_name} registered · ${wristband_barcode ?? 'no wristband'}${qosInfo}`, payload.timestamp);
  console.log(`[Camp Data] Register: ${person.full_name} (id=${person.id}, wb=${wristband_barcode ?? '-'})`);
}

function onCheckin(payload) {
  checkDayRollover();
  const { person, wristband_barcode } = payload;
  if (!person?.id) return;

  const existing = store.persons.get(person.id) || {};
  const merged = { ...existing, ...person, wristband_barcode: wristband_barcode ?? existing.wristband_barcode };
  store.persons.set(person.id, merged);
  if (merged.wristband_barcode) store.wristbandPerson.set(merged.wristband_barcode, merged);

  store.day.checkin_ids.add(person.id);

  savePerson(merged);
  persistToday();

  pushEvent('checkin', `${person.full_name} checked in · ${wristband_barcode ?? merged.wristband_barcode ?? '-'}`, payload.timestamp);
  console.log(`[Camp Data] Checkin: ${person.full_name} (id=${person.id})`);
}

function onDistribution(payload) {
  checkDayRollover();
  const { barcode, resource_type, person_name } = payload;
  if (!barcode || !resource_type) return;

  const key = `${barcode}:${resource_type}:${todayDate()}`;
  store.distributions.add(key);

  if (MEAL_TYPES.includes(resource_type)) {
    store.day.distributions[resource_type]++;
  }

  pushEvent('distribution', `${person_name ?? barcode} received ${resource_type}`, payload.timestamp);
  console.log(`[Camp Data] Distribute: ${resource_type} -> ${person_name ?? barcode}`);
}

// ── Computed overview (called by REST route) ───────────────────────────────

export function getOverview() {
  const persons = Array.from(store.persons.values());
  const total = persons.length;
  const pregnant = persons.filter((p) => p.is_pregnant).length;
  const chronic = persons.filter((p) => p.has_chronic_illness).length;
  const families = new Set(persons.map((p) => p.family_unit_id).filter(Boolean)).size;

  const wristbands = new Set(persons.filter((p) => p.wristband_barcode).map((p) => p.wristband_barcode));
  const eligible = wristbands.size;
  const todayCheckins = store.day.checkin_ids.size;
  const attendanceRate = total > 0 ? Math.round((todayCheckins / total) * 100) : 0;

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

  const prediction_tomorrow = computePrediction({
    snapshots: store.dailySnapshots,
    totalPersons: total,
    persons,
    pregnant,
  });

  const recent_registrations = persons
    .filter((p) => p.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  const recent_events = store.events.slice(0, 20);

  return {
    source: 'cloud_mqtt',
    last_updated: store.lastUpdated,
    mqtt: {
      connected: store.mqttConnected,
      network_state: store.mqttConnected ? 'STABLE' : 'DISCONNECTED',
      buffered_messages: 0,
    },
    population: {
      total,
      today_registered: store.day.new_registrations,
      today_checkins: todayCheckins,
      attendance_rate_pct: attendanceRate,
      families,
    },
    vulnerable: {
      pregnant,
      chronic_illness: chronic,
      total_flagged: pregnant + chronic,
    },
    eligible_for_distribution: eligible,
    distribution_today,
    prediction_tomorrow,
    recent_registrations,
    recent_events,
  };
}

// ── MQTT connection ────────────────────────────────────────────────────────

/**
 * Rebuild the in-memory picture from disk before MQTT starts delivering.
 * Without this the forecaster restarts at zero observations every boot.
 */
async function hydrateFromDb() {
  const persons = await loadPersons();
  for (const person of persons) {
    store.persons.set(person.id, {
      ...person,
      is_pregnant: !!person.is_pregnant,
      has_chronic_illness: !!person.has_chronic_illness,
    });
    if (person.wristband_barcode) store.wristbandPerson.set(person.wristband_barcode, person);
  }

  const today = todayDate();
  for (const snapshot of await loadSnapshots(30)) {
    if (snapshot.date === today) {
      store.day.new_registrations = snapshot.new_registrations;
      continue;
    }
    store.dailySnapshots.push({
      date: snapshot.date,
      total_persons: snapshot.total_persons,
      new_registrations: snapshot.new_registrations,
      checkins: snapshot.checkins,
      attendance_rate: snapshot.total_persons > 0 ? snapshot.checkins / snapshot.total_persons : 0,
      distributions: {},
    });
  }

  console.log(
    `[Camp Data] Restored ${persons.length} person(s) and ` +
      `${store.dailySnapshots.length} day(s) of population history from disk`,
  );
}

export async function startCampDataService() {
  await hydrateFromDb();

  let ca;
  try {
    ca = fs.readFileSync(caCertPath);
  } catch {
    // CA certificate is optional
  }

  const client = mqtt.connect(`mqtts://${host}:${port}`, {
    clientId: `cloud-admin-${Date.now()}`,
    username,
    password,
    protocol: 'mqtts',
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    ...(ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }),
  });

  client.on('connect', () => {
    store.mqttConnected = true;
    console.log('[Camp Data] Connected to EMQX broker');
    client.subscribe('smartcamp/#', { qos: 2 }, (err) => {
      if (err) console.error('[Camp Data] Subscribe failed:', err.message);
      else console.log('[Camp Data] Subscribed to smartcamp/# (QoS 2)');
    });
  });

  client.on('message', (topic, buffer) => {
    try {
      const payload = JSON.parse(buffer.toString());
      if (topic === 'smartcamp/registration/new') onRegistration(payload);
      else if (topic === 'smartcamp/registration/checkin') onCheckin(payload);
      else if (topic === 'smartcamp/distribution/log') onDistribution(payload);
    } catch (e) {
      console.error('[Camp Data] Parse error:', e.message);
    }
  });

  client.on('close', () => {
    store.mqttConnected = false;
    console.log('[Camp Data] Disconnected from EMQX');
  });
  client.on('reconnect', () => console.log('[Camp Data] Reconnecting to EMQX...'));
  client.on('error', (err) => console.error('[Camp Data] MQTT error:', err.message));

  setInterval(() => {
    if (store.day.date !== todayDate()) rolloverDay();
  }, 60 * 60 * 1000);

  return client;
}

export const _store = store;

// ── Live bridge from the sync receiver ─────────────────────────────────────
//
// syncReceiver writes straight to Postgres, while everything the resources API
// serves reads this in-memory roster. The roster is filled once, by
// hydrateFromDb() at boot — so before this bridge existed, a person registered
// on the Pi landed in the database and stayed invisible to /api/resources until
// somebody restarted the process. Population read 0, and every prediction
// downstream divided by it and returned zeros.
//
// These take the persons/wristbands row shape (the sync payload), not the
// {person, wristband_barcode} envelope that onRegistration() handles.

/** Mirror a synced persons row into the live roster. */
export function applySyncedPerson(row) {
  if (!row?.id) return;

  // is_active is 0/1 from SQLite on the Pi; loadPersons() filters on it, so the
  // roster has to honour a deactivation too, not just additions.
  if (Number(row.is_active ?? 1) !== 1) {
    const gone = store.persons.get(row.id);
    if (gone?.wristband_barcode) store.wristbandPerson.delete(gone.wristband_barcode);
    store.persons.delete(row.id);
    return;
  }

  const existing = store.persons.get(row.id) || {};
  const merged = {
    ...existing,
    ...row,
    is_pregnant: !!Number(row.is_pregnant),
    has_chronic_illness: !!Number(row.has_chronic_illness),
    // A wristband may sync before or after its person; never let the person
    // row blank out a barcode already recorded.
    wristband_barcode: existing.wristband_barcode,
  };

  store.persons.set(row.id, merged);
  if (merged.wristband_barcode) store.wristbandPerson.set(merged.wristband_barcode, merged);
}

/** Attach a synced wristbands row to its person in the live roster. */
export function applySyncedWristband(row) {
  if (!row?.barcode || !row.person_id) return;

  if (Number(row.is_active ?? 1) !== 1) {
    store.wristbandPerson.delete(row.barcode);
    const holder = store.persons.get(row.person_id);
    if (holder?.wristband_barcode === row.barcode) {
      store.persons.set(row.person_id, { ...holder, wristband_barcode: undefined });
    }
    return;
  }

  // The person may not have arrived yet — record the barcode so the person
  // handler above can pick it up when it does.
  const person = store.persons.get(row.person_id) || { id: row.person_id };
  const merged = { ...person, wristband_barcode: row.barcode };
  store.persons.set(row.person_id, merged);
  store.wristbandPerson.set(row.barcode, merged);
}

// ── Accessors for the Distribution domain ──────────────────────────────────

/** Live person records, for cohort derivation. */
export function getPersons() {
  return Array.from(store.persons.values());
}

/**
 * Cumulative population history, oldest first, as
 * [{ date: 'YYYY-MM-DD', population }] — the shape forecastPopulation() wants.
 */
export async function getPopulationHistory() {
  // Primary: cumulative registrations by date, derived from the roster. This
  // is exact and survives restarts, backfills and out-of-order delivery.
  const fromRoster = await loadPopulationHistory();
  if (fromRoster.length) {
    const today = todayDate();
    const last = fromRoster[fromRoster.length - 1];
    if (last.date !== today) {
      fromRoster.push({ date: today, population: store.persons.size || last.population });
    } else {
      last.population = Math.max(last.population, store.persons.size);
    }
    return fromRoster;
  }

  // Fallback: rollover snapshots, for rosters with no usable created_at.
  const history = store.dailySnapshots.map((snapshot) => ({
    date: snapshot.date,
    population: snapshot.total_persons,
  }));
  const today = todayDate();
  if (!history.some((row) => row.date === today)) {
    history.push({ date: today, population: store.persons.size });
  }
  return history;
}
