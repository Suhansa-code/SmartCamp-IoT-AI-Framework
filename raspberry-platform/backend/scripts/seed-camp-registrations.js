#!/usr/bin/env node
/**
 * Seed the camp registration database with a realistic Sri Lankan camp roster.
 *
 * Why
 * ---
 * The cloud seven-day forecast fits a trend on daily registration counts, and
 * the ration rule needs cohort counts (children / adults / elderly / pregnant).
 * A camp with no registrations produces a correct but empty prediction. This
 * script populates the Pi database so the whole path -- Pi -> EMQX -> cloud ->
 * forecast -> dashboard -- carries real numbers.
 *
 * What is realistic here, and what is not
 * ---------------------------------------
 * Demography is grounded, arrival timing is generated.
 *
 *   Age structure   Sri Lanka Census of Population and Housing 2012 (DCS), the
 *                   most recent full census: 25.2 % under 15, 12.4 % aged 60+.
 *                   Broadened here to under-18 / 60+ to match the model's
 *                   cohort bands, giving roughly 28 % children and 12 % elderly.
 *   Pregnancy       4.4 % of women aged 15-49, derived from Sri Lanka's crude
 *                   birth rate of ~15.4 per 1,000 (World Bank): pregnant at any
 *                   moment ~= CBR x 0.75 = 1.15 % of the population, and women
 *                   15-49 are ~26 % of it.
 *   Household size  3.8 persons, DCS 2012.
 *   Names           Common Sinhala, Tamil and Muslim Sri Lankan names, mixed in
 *                   roughly national proportion, so the roster reads plausibly.
 *
 *   Arrival curve   GENERATED. No Sri Lankan camp registration time series
 *                   exists to copy (see prediction-models/resource-model/
 *                   README.md). Intake here is a saturating curve with noise.
 *
 * These are seeded records. Anyone reading a prediction derived from them must
 * know that. Every seeded person carries person_type-independent marker fields:
 * medical_notes begins with [SEED] and the fingerprint_id begins with SEED-.
 *
 * Usage
 * -----
 *   node scripts/seed-camp-registrations.js --count 100 --days 10
 *   node scripts/seed-camp-registrations.js --count 100 --days 10 --publish
 *   node scripts/seed-camp-registrations.js --clear
 *
 * --publish sends each registration to EMQX so the cloud picks it up live.
 * Without it, records are written locally only.
 */
import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { campDb as db } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SEED_MARK = '[SEED]';
const SEED_FP = 'SEED-';

// ── Sri Lankan name pools ──────────────────────────────────────────────────
const SINHALA_M = ['Kasun', 'Nuwan', 'Chamara', 'Dinesh', 'Sampath', 'Ruwan', 'Lahiru', 'Tharindu', 'Isuru', 'Suranga'];
const SINHALA_F = ['Nimali', 'Chathurika', 'Dilrukshi', 'Sanduni', 'Ishara', 'Malini', 'Hasini', 'Tharushi', 'Amaya', 'Kumari'];
const SINHALA_S = ['Perera', 'Silva', 'Fernando', 'Jayasuriya', 'Bandara', 'Wickramasinghe', 'Rajapaksa', 'Gunawardena', 'Dissanayake', 'Ekanayake'];
const TAMIL_M = ['Arun', 'Suresh', 'Mathan', 'Kirushanth', 'Vimal', 'Ravi', 'Thivakar', 'Nirmal'];
const TAMIL_F = ['Kavitha', 'Shanthi', 'Priya', 'Vasanthi', 'Nirosha', 'Devi', 'Anjali'];
const TAMIL_S = ['Kumar', 'Rajan', 'Sivakumar', 'Thevan', 'Balasingham', 'Nadarajah', 'Selvam'];
const MUSLIM_M = ['Mohamed', 'Ahamed', 'Rizwan', 'Fazil', 'Nazeer'];
const MUSLIM_F = ['Fathima', 'Ayesha', 'Nasreen', 'Zahra', 'Rizna'];
const MUSLIM_S = ['Farook', 'Hussain', 'Rahman', 'Ismail', 'Jalaldeen'];

// Census 2012 ethnic proportion, rounded: Sinhalese 75 %, Tamil 15 %, Moor 10 %.
const GROUPS = [
  { w: 0.75, m: SINHALA_M, f: SINHALA_F, s: SINHALA_S },
  { w: 0.15, m: TAMIL_M, f: TAMIL_F, s: TAMIL_S },
  { w: 0.10, m: MUSLIM_M, f: MUSLIM_F, s: MUSLIM_S },
];

// Census 2012 age structure, widened to the model's cohort bands.
const AGE_BANDS = [
  { w: 0.28, lo: 0, hi: 17 },   // children
  { w: 0.60, lo: 18, hi: 59 },  // adults
  { w: 0.12, lo: 60, hi: 88 },  // elderly
];

// ── deterministic RNG so a seeded camp is reproducible ─────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted(rng, items) {
  let r = rng();
  for (const item of items) {
    if ((r -= item.w) <= 0) return item;
  }
  return items[items.length - 1];
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function makePerson(rng) {
  const group = weighted(rng, GROUPS);
  const gender = rng() < 0.5 ? 'M' : 'F';
  const band = weighted(rng, AGE_BANDS);
  const age = band.lo + Math.floor(rng() * (band.hi - band.lo + 1));

  const given = gender === 'M' ? pick(rng, group.m) : pick(rng, group.f);
  const full_name = `${given} ${pick(rng, group.s)}`;

  // Pregnancy only where it is possible: women aged 15-49.
  // Prevalence derived from Sri Lanka's crude birth rate (~15.4 per 1,000,
  // World Bank): pregnant at any moment ~= CBR x 0.75 = 1.15 % of the whole
  // population. Women 15-49 are ~26 % of the population, so prevalence within
  // that group is 1.15 / 26 = 4.4 %.
  const is_pregnant = gender === 'F' && age >= 15 && age <= 49 && rng() < 0.044 ? 1 : 0;
  // Chronic illness rises sharply with age; rough NCD prevalence pattern.
  const chronicRate = age >= 60 ? 0.35 : age >= 40 ? 0.15 : 0.03;
  const has_chronic_illness = rng() < chronicRate ? 1 : 0;

  return {
    full_name,
    age,
    gender,
    is_pregnant,
    has_chronic_illness,
    family_size: 1 + Math.floor(rng() * 6), // mean ~3.8 (DCS 2012)
  };
}

/** Saturating arrival curve: fast onset, then plateau. */
function arrivalsPerDay(count, days, rng) {
  const cumulative = [];
  for (let i = 0; i < days; i++) {
    const t = (i + 1) / days;
    cumulative.push(1 / (1 + Math.exp(-8 * (t - 0.42))));
  }
  const base = cumulative[0];
  const span = cumulative[days - 1] - base;
  const scaled = cumulative.map((c) => ((c - base) / span) * count);

  const perDay = [];
  let placed = 0;
  for (let i = 0; i < days; i++) {
    const target = Math.round(scaled[i] * (1 + (rng() - 0.5) * 0.15));
    const n = Math.max(i === days - 1 ? count - placed : 1, target - placed);
    perDay.push(Math.min(n, count - placed));
    placed += perDay[i];
  }
  if (placed < count) perDay[days - 1] += count - placed;
  return perDay;
}

function clear() {
  const tx = db.transaction(() => {
    const ids = db.prepare(`SELECT id FROM persons WHERE fingerprint_id LIKE '${SEED_FP}%'`).all().map((r) => r.id);
    if (!ids.length) return 0;
    const list = ids.join(',');
    db.exec(`UPDATE wristbands SET person_id = NULL, status = 'AVAILABLE', assigned_at = NULL WHERE person_id IN (${list})`);
    db.exec(`DELETE FROM wristband_assignments WHERE person_id IN (${list})`);
    db.exec(`DELETE FROM camp_checkins WHERE person_id IN (${list})`);
    db.exec(`DELETE FROM persons WHERE id IN (${list})`);
    return ids.length;
  });
  const removed = tx();
  console.log(`Removed ${removed} seeded person(s); their wristbands returned to AVAILABLE.`);
}

function seed({ count, days, seedValue }) {
  const rng = mulberry32(seedValue);
  const perDay = arrivalsPerDay(count, days, rng);

  const available = db
    .prepare("SELECT id, barcode FROM wristbands WHERE status = 'AVAILABLE' AND person_id IS NULL ORDER BY id")
    .all();

  if (available.length < count) {
    console.warn(
      `Only ${available.length} AVAILABLE wristband(s) for ${count} people — ` +
        `${count - available.length} person(s) will be registered without one.`,
    );
  }

  const insertPerson = db.prepare(`
    INSERT INTO persons (fingerprint_id, full_name, age, gender, person_type, family_unit_id,
      family_size, is_pregnant, has_chronic_illness, medical_notes, pre_registered,
      created_at, registration_date, is_active)
    VALUES (@fingerprint_id, @full_name, @age, @gender, 'idp', @family_unit_id,
      @family_size, @is_pregnant, @has_chronic_illness, @medical_notes, 0,
      @created_at, @created_at, 1)
  `);
  const insertCheckin = db.prepare(
    'INSERT INTO camp_checkins (person_id, checkin_time, camp_day, is_new_arrival) VALUES (?, ?, ?, 1)',
  );
  const assignWristband = db.prepare(
    "UPDATE wristbands SET person_id = ?, status = 'ASSIGNED', assigned_at = ?, updated_at = ? WHERE id = ?",
  );
  const recordAssignment = db.prepare(
    'INSERT INTO wristband_assignments (wristband_id, person_id, assigned_at) VALUES (?, ?, ?)',
  );

  const created = [];
  let wbIndex = 0;

  const tx = db.transaction(() => {
    for (let d = 0; d < days; d++) {
      const daysAgo = days - 1 - d;
      const stamp = new Date(Date.now() - daysAgo * 86_400_000);
      for (let k = 0; k < perDay[d]; k++) {
        // Spread arrivals across daylight hours rather than all at midnight.
        stamp.setHours(7 + Math.floor(rng() * 11), Math.floor(rng() * 60), 0, 0);
        const createdAt = stamp.toISOString().slice(0, 19).replace('T', ' ');

        const person = makePerson(rng);
        const info = insertPerson.run({
          ...person,
          fingerprint_id: `${SEED_FP}${Date.now()}-${created.length}`,
          family_unit_id: `SEEDFAM-${Math.floor(created.length / 4)}`,
          medical_notes: `${SEED_MARK} generated roster record`,
          created_at: createdAt,
        });
        const personId = Number(info.lastInsertRowid);

        insertCheckin.run(personId, createdAt, d + 1);

        let barcode = null;
        if (wbIndex < available.length) {
          const wb = available[wbIndex++];
          assignWristband.run(personId, createdAt, createdAt, wb.id);
          recordAssignment.run(wb.id, personId, createdAt);
          barcode = wb.barcode;
        }

        created.push({ id: personId, barcode, created_at: createdAt, ...person });
      }
    }
  });

  tx();
  return { created, perDay };
}

async function publish(created) {
  const host = process.env.EMQX_HOST;
  const port = process.env.EMQX_PORT || 8883;
  const username = process.env.EMQX_USERNAME || 'admin';
  const password = process.env.EMQX_PASSWORD || 'admin@123';
  if (!host) {
    console.warn('EMQX_HOST is not set — skipping publish. Records are in the local database.');
    return;
  }

  let ca;
  try {
    ca = fs.readFileSync(path.join(__dirname, '../emqxsl-ca.crt'));
  } catch { /* optional */ }

  const client = mqtt.connect(`mqtts://${host}:${port}`, {
    clientId: `seed-publisher-${Date.now()}`,
    username, password, protocol: 'mqtts', clean: true, connectTimeout: 10_000,
    ...(ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }),
  });

  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });
  console.log(`Connected to ${host}:${port}, publishing ${created.length} registration(s)…`);

  for (const person of created) {
    const payload = {
      event: 'new_registration',
      person: {
        id: person.id,
        full_name: person.full_name,
        age: person.age,
        gender: person.gender,
        is_pregnant: person.is_pregnant,
        has_chronic_illness: person.has_chronic_illness,
        family_unit_id: `SEEDFAM-${Math.floor(person.id / 4)}`,
        created_at: person.created_at,
      },
      wristband_barcode: person.barcode,
      timestamp: new Date(person.created_at.replace(' ', 'T') + 'Z').toISOString(),
    };
    await new Promise((resolve, reject) =>
      client.publish('smartcamp/registration/new', JSON.stringify(payload), { qos: 1 },
        (err) => (err ? reject(err) : resolve())),
    );
  }

  await new Promise((resolve) => client.end(false, {}, resolve));
  console.log('Published.');
}

// ── main ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

if (args.includes('--clear')) {
  clear();
  process.exit(0);
}

const count = Number.parseInt(opt('count', '100'), 10);
const days = Number.parseInt(opt('days', '10'), 10);
const seedValue = Number.parseInt(opt('seed', '2026'), 10);

const { created, perDay } = seed({ count, days, seedValue });

const children = created.filter((p) => p.age <= 17).length;
const elderly = created.filter((p) => p.age >= 60).length;
const pregnant = created.filter((p) => p.is_pregnant).length;
const withBand = created.filter((p) => p.barcode).length;

console.log(`\nSeeded ${created.length} people over ${days} days.`);
console.log(`  arrivals/day : ${perDay.join(' ')}`);
console.log(`  cumulative   : ${perDay.reduce((acc, n) => [...acc, (acc.at(-1) ?? 0) + n], []).join(' ')}`);
console.log(`  children <18 : ${children} (${(children / created.length * 100).toFixed(1)} %)`);
console.log(`  elderly 60+  : ${elderly} (${(elderly / created.length * 100).toFixed(1)} %)`);
console.log(`  pregnant     : ${pregnant}`);
console.log(`  wristbands   : ${withBand} assigned`);
console.log(`\nThese are SEEDED records (fingerprint_id ${SEED_FP}*). Run --clear to remove them.`);

if (args.includes('--publish')) {
  await publish(created);
}
