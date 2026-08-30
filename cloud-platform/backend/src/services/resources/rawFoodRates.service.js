/**
 * Raw food rates — kg of AS-ACQUIRED food per person per day, by age band.
 *
 * Two different questions need two different bases, and mixing them is a real
 * error rather than a rounding one:
 *
 *   what the kitchen SERVES   cooked weight   ration_rates.json   (1.60 kg/adult)
 *   what the store HOLDS      raw weight      this artifact       (0.91 kg/adult)
 *
 * Rice roughly doubles when cooked, so subtracting cooked demand from a raw
 * stock level over-states the draw-down by about 1.75x and halves the projected
 * days of cover. Stock runout therefore runs on these rates; meal distribution
 * keeps the cooked ones.
 *
 * Produced by prediction-models/scripts/train_raw_food_model.py — a no-intercept
 * regression of household kg/day on six age-band counts, fitted on the BRIGHT
 * Sri Lanka household survey (6,802 households, 27,689 people), with bootstrap
 * confidence intervals on every coefficient.
 */
import fs from 'fs';
import { env } from '../../config/env.js';

// Band edges, matching the artifact's age_range fields.
export const BANDS = [
  { key: 'infant_0_5', min: 0, max: 5 },
  { key: 'child_6_14', min: 6, max: 14 },
  { key: 'teen_15_17', min: 15, max: 17 },
  { key: 'adult_18_59', min: 18, max: 59 },
  { key: 'eld_60_74', min: 60, max: 74 },
  { key: 'eld_75plus', min: 75, max: 130 },
];

let cache = null;

function load() {
  const path = env.resources.foodRatesRawPath;
  let raw;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(
      `Raw food rate table not found at ${path}. ` +
        'Run: python scripts/train_raw_food_model.py in cloud-platform/prediction-models, ' +
        `or set FOOD_RATES_RAW_PATH. (${err.code})`,
    );
  }
  const table = JSON.parse(raw);
  const missing = BANDS.filter((b) => typeof table.rates?.[b.key]?.kg_per_day !== 'number');
  if (missing.length) {
    throw new Error(
      `Raw food rate table at ${path} is missing bands: ${missing.map((b) => b.key).join(', ')}`,
    );
  }
  console.log(
    `[RawRates] ${table.artifact_id} loaded — adult ${table.rates.adult_18_59.kg_per_day} kg/day ` +
      `raw (${table.training_data.n_people.toLocaleString()} people)`,
  );
  return table;
}

export function getRawRates() {
  if (!cache) cache = load();
  return cache;
}

export function reloadRawRates() {
  cache = null;
  return getRawRates();
}

/** Age -> band key. Ages outside 0-130 clamp to the nearest band. */
export function bandForAge(age) {
  // Number(null) and Number('') are both 0, which would silently price an
  // unrecorded age as an infant -- the cheapest band. Reject them explicitly.
  if (age === null || age === undefined || age === '') return null;
  const a = Number(age);
  if (!Number.isFinite(a) || a < 0) return null;
  const band = BANDS.find((b) => a >= b.min && a <= b.max);
  return band ? band.key : BANDS[BANDS.length - 1].key;
}

/**
 * Raw food required per day, in kg.
 *
 * Give a roster of people with ages for an exact figure. Without ages, the
 * population is priced at the survey's own age mix, which is stated rather
 * than assumed to be all adults.
 *
 * @returns {{ food_kg_day: number, basis: string, breakdown: object, priced_from: string }}
 */
export function rawDailyFood({ persons = null, totalPopulation = 0 } = {}) {
  const table = getRawRates();
  const rate = (key) => table.rates[key].kg_per_day;

  if (Array.isArray(persons) && persons.length) {
    const counts = Object.fromEntries(BANDS.map((b) => [b.key, 0]));
    let unknown = 0;
    for (const p of persons) {
      const key = bandForAge(p?.age);
      if (key) counts[key] += 1;
      else unknown += 1;
    }
    // People with no usable age are priced at the survey's population mean
    // rather than dropped, which would silently under-order for them.
    const mean = table.training_data
      ? BANDS.reduce((s, b) => s + rate(b.key) * table.rates[b.key].n_people, 0) /
        BANDS.reduce((s, b) => s + table.rates[b.key].n_people, 0)
      : rate('adult_18_59');

    const total = BANDS.reduce((s, b) => s + counts[b.key] * rate(b.key), 0) + unknown * mean;
    return {
      food_kg_day: Math.round(total * 10) / 10,
      basis: table.basis,
      priced_from: 'roster ages',
      breakdown: {
        ...Object.fromEntries(BANDS.map((b) => [b.key, { count: counts[b.key], rate: rate(b.key) }])),
        unknown_age: { count: unknown, rate: Math.round(mean * 1000) / 1000 },
      },
    };
  }

  // No roster: price the headcount at the survey's own age composition.
  const totalPeople = BANDS.reduce((s, b) => s + table.rates[b.key].n_people, 0);
  const perPerson = BANDS.reduce(
    (s, b) => s + rate(b.key) * (table.rates[b.key].n_people / totalPeople), 0,
  );
  const pop = Math.max(0, Math.round(Number(totalPopulation) || 0));
  return {
    food_kg_day: Math.round(pop * perPerson * 10) / 10,
    basis: table.basis,
    priced_from: 'survey age composition (no roster ages available)',
    breakdown: { population: pop, mean_rate_kg_person_day: Math.round(perPerson * 10000) / 10000 },
  };
}
