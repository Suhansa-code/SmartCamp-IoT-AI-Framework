/**
 * CampStoreRepository — durable storage for the camp roster and the daily
 * population history the seven-day forecast fits on.
 *
 * Why this exists: the camp roster arrives over MQTT and was previously held
 * only in memory. Daily snapshots were appended by rolloverDay(), which fires
 * when the process happens to run across midnight, so any restart discarded the
 * registration history. The forecaster needs three distinct days before it can
 * estimate a trend at all and seven before it reports HIGH confidence, so in
 * practice it never got past the cold-start fallback.
 *
 * Persisting both means history survives restarts and accumulates for real.
 *
 * Every function is a no-op returning an empty result when the database is
 * disabled, so the in-memory path keeps working without Postgres.
 */
import { getPool } from '../../config/database.js';
import { env } from '../../config/env.js';

/** Postgres is optional — without it the roster simply stays in memory. */
function pool() {
  return env.db.enabled ? getPool() : null;
}

// ── persons ────────────────────────────────────────────────────────────────

const UPSERT_PERSON = `
  INSERT INTO camp_persons
    (id, full_name, age, gender, family_unit_id, is_pregnant,
     has_chronic_illness, wristband_barcode, created_at, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO UPDATE SET
    full_name           = EXCLUDED.full_name,
    age                 = EXCLUDED.age,
    gender              = EXCLUDED.gender,
    family_unit_id      = EXCLUDED.family_unit_id,
    is_pregnant         = EXCLUDED.is_pregnant,
    has_chronic_illness = EXCLUDED.has_chronic_illness,
    -- keep an existing barcode if the new payload has none
    wristband_barcode   = COALESCE(EXCLUDED.wristband_barcode, camp_persons.wristband_barcode),
    created_at          = COALESCE(camp_persons.created_at, EXCLUDED.created_at),
    updated_at          = CURRENT_TIMESTAMP
`;

/** Persist one person record. Safe to call repeatedly for the same id. */
export async function savePerson(person) {
  const db = pool();
  if (!db || !person?.id) return;
  try {
    await db.query(UPSERT_PERSON, [
      person.id,
      person.full_name ?? null,
      Number.isFinite(Number(person.age)) ? Number(person.age) : null,
      person.gender ?? null,
      person.family_unit_id ?? null,
      person.is_pregnant ? 1 : 0,
      person.has_chronic_illness ? 1 : 0,
      person.wristband_barcode ?? null,
      person.created_at ?? null,
    ]);
  } catch (err) {
    // Persistence must never take the MQTT handler down.
    console.error('[Camp Store] savePerson failed:', err.message);
  }
}

/**
 * Every stored person, for rehydrating the in-memory roster on boot.
 *
 * Reads `persons` — the table the Pi's durable sync writes — rather than
 * `camp_persons`, which only the fire-and-forget smartcamp/registration/new
 * mirror fills. Both wristbands.person_id and camp_checkins.person_id are
 * declared REFERENCES persons(id), so `persons` is the roster the rest of the
 * schema is already keyed to; reading camp_persons left the forecaster with an
 * empty roster while the synced records sat one table over.
 *
 * is_active = 0 marks someone who has left the camp. camp_persons had no way
 * to express that, so departures used to inflate every cohort.
 *
 * wristband_barcode is the one field camp_persons had that persons lacks; it
 * lives in wristbands, joined here so the shape callers receive is unchanged.
 */
export async function loadPersons() {
  const db = pool();
  if (!db) return [];
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.full_name, p.age, p.gender, p.family_unit_id,
             p.family_size, p.is_pregnant, p.has_chronic_illness,
             p.person_type, p.created_at,
             w.barcode AS wristband_barcode
        FROM persons p
        LEFT JOIN wristbands w
               ON w.person_id = p.id AND w.is_active = 1
       WHERE COALESCE(p.is_active, 1) = 1
    `);
    return rows;
  } catch (err) {
    console.error('[Camp Store] loadPersons failed:', err.message);
    return [];
  }
}

// ── daily snapshots ────────────────────────────────────────────────────────

const UPSERT_SNAPSHOT = `
  INSERT INTO camp_daily_snapshots (date, total_persons, new_registrations, checkins, updated_at)
  VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
  ON CONFLICT (date) DO UPDATE SET
    total_persons     = EXCLUDED.total_persons,
    new_registrations = EXCLUDED.new_registrations,
    checkins          = EXCLUDED.checkins,
    updated_at        = CURRENT_TIMESTAMP
`;

/**
 * Write today's running totals. Called on every event rather than only at
 * midnight, so a restart mid-day does not lose the day.
 */
export async function saveSnapshot({ date, total_persons, new_registrations = 0, checkins = 0 }) {
  const db = pool();
  if (!db || !date) return;
  try {
    await db.query(UPSERT_SNAPSHOT, [date, total_persons, new_registrations, checkins]);
  } catch (err) {
    console.error('[Camp Store] saveSnapshot failed:', err.message);
  }
}

/** Stored daily snapshots, oldest first, capped to the most recent `limit`. */
export async function loadSnapshots(limit = 30) {
  const db = pool();
  if (!db) return [];
  try {
    const { rows } = await db.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date, total_persons, new_registrations,
              checkins, updated_at
         FROM camp_daily_snapshots ORDER BY date DESC LIMIT $1`,
      [limit],
    );
    return rows.reverse();
  } catch (err) {
    console.error('[Camp Store] loadSnapshots failed:', err.message);
    return [];
  }
}

/**
 * Cumulative population by registration date, derived from the roster itself:
 *
 *     date -> number of people registered on or before that date
 *
 * This is the primary source for the forecaster's history. Deriving it from
 * `created_at` rather than from midnight rollover snapshots means the history
 * is correct immediately after a backfill, a restart, or a burst of messages
 * that arrive out of order — none of which a rollover-only history survives.
 *
 * People whose record carries no created_at cannot be placed on a date. They
 * are treated as present from the beginning (added to every cumulative point)
 * rather than dropped, so the series still ends at the true headcount.
 */
export async function loadPopulationHistory() {
  const db = pool();
  if (!db) return [];
  try {
    const { rows: dated } = await db.query(`
      SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS arrivals
      FROM persons
      WHERE created_at IS NOT NULL
        AND COALESCE(is_active, 1) = 1
      GROUP BY created_at::date
      ORDER BY created_at::date
    `);

    if (!dated.length) return [];

    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS undated FROM persons
        WHERE created_at IS NULL AND COALESCE(is_active, 1) = 1`,
    );

    let running = rows[0]?.undated || 0;
    return dated.map((row) => {
      running += row.arrivals;
      return { date: row.date, population: running };
    });
  } catch (err) {
    console.error('[Camp Store] loadPopulationHistory failed:', err.message);
    return [];
  }
}
