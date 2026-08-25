/**
 * RationRatesService — loads the Sri Lanka ration rate table.
 *
 * The rate table is produced by
 *   cloud-platform/prediction-models/scripts/build_lka_rate_table.py
 * and written to models/lka_v2/ration_rates.json. It is deliberately stored as
 * JSON rather than a pickled model so that both the Python pipeline and this
 * Node backend read exactly the same numbers from one artifact.
 *
 * Every rate carries an `evidence` field:
 *   measured                 — derived from a Sri Lankan dataset
 *   production configuration — read from the live distribution config
 *   humanitarian standard    — a named external standard (Sphere)
 *   ASSUMPTION               — not measured; surfaced to the operator
 *
 * Shelter units and medical staffing are out of scope for this model and are
 * listed in the artifact's `out_of_scope` field.
 */
import fs from 'fs';
import { env } from '../../config/env.js';

// Cohort boundaries. The rate table names the bands (child <18, adult 18-59,
// elderly 60+); the survey behind the child rate covers ages 6-14 only.
export const CHILD_MAX_AGE = 17;
export const ELDERLY_MIN_AGE = 60;
// The elderly cohort splits at 75: the BRIGHT household survey measures 60-74
// eating slightly MORE than working-age adults (1.066x) while 75+ eat less
// (0.855x). A single elderly rate averages away a real 25 % difference.
export const ELDERLY_OLD_AGE = 75;

const REQUIRED_RATES = [
  'food_child',
  'food_adult',
  'food_elderly',
  'food_elderly_75plus',
  'food_elderly_blended',
  'food_pregnant_topup',
  'water_drinking',
];

let cache = null;

function load() {
  const path = env.resources.rationRatesPath;

  let raw;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(
      `Ration rate table not found at ${path}. ` +
        'Run: python scripts/build_lka_rate_table.py in cloud-platform/prediction-models, ' +
        `or set RATION_RATES_PATH. (${err.code})`,
    );
  }

  const table = JSON.parse(raw);

  const missing = REQUIRED_RATES.filter((key) => typeof table[key]?.value !== 'number');
  if (missing.length) {
    throw new Error(`Rate table at ${path} is missing rates: ${missing.join(', ')}`);
  }

  console.log(
    `[Rations] Rate table v${table.schema_version} loaded — child ${table.food_child.value} / ` +
      `adult ${table.food_adult.value} / elderly ${table.food_elderly.value} kg, ` +
      `water ${table.water_drinking.value} L per person per day`,
  );

  return table;
}

/** The parsed rate table. Cached — call reloadRates() after a rebuild. */
export function getRates() {
  if (!cache) cache = load();
  return cache;
}

/** Drop the cache so the next getRates() re-reads the artifact from disk. */
export function reloadRates() {
  cache = null;
  return getRates();
}

/**
 * Provenance for every rate, for the UI and the project report.
 * Assumptions are flagged so the operator can see which numbers are measured.
 */
export function getProvenance() {
  const table = getRates();
  return {
    schema_version: table.schema_version,
    generated_at: table.generated_at,
    generated_by: table.generated_by,
    scope: table.scope,
    out_of_scope: table.out_of_scope ?? [],
    cohorts: {
      child_max_age: CHILD_MAX_AGE,
      elderly_min_age: ELDERLY_MIN_AGE,
      elderly_old_age: ELDERLY_OLD_AGE,
    },
    rates: REQUIRED_RATES.map((key) => {
      const entry = table[key];
      return {
        key,
        value: entry.value,
        unit: entry.unit,
        evidence: entry.evidence,
        source: entry.source,
        caveat: entry.caveat ?? null,
        is_assumption: String(entry.evidence).startsWith('ASSUMPTION'),
      };
    }),
    corroboration: table.corroboration ?? null,
    population_scale: table.population_scale ?? null,
  };
}
