/**
 * ChildIntakeModelService — the ML component of the resource model.
 *
 * Applies the Ridge regression trained on the Sri Lankan dietary recall survey
 * (prediction-models/scripts/train_lka_intake_model.py). The artifact stores the
 * fitted model as plain numbers — feature order, scaler mean/scale,
 * coefficients, intercept — so this file reproduces scikit-learn's prediction
 * exactly without any Python at runtime.
 *
 * Scope: children only. Adults and elderly are priced from the rate table,
 * whose elderly bands now come from measured household-survey ratios.
 *
 * Honest accuracy note: cross-validated per-person R2 is ~0.07. Single-day food
 * intake is dominated by individual variation, so this model is not accurate for
 * one child and does not claim to be. It earns its place at camp scale, where
 * that error averages down, and because it predicts conditional MEANS — the rate
 * table's median under-provisions a camp total by ~8 % regardless of size, since
 * that error is bias rather than noise.
 */
import fs from 'fs';
import path from 'path';
import { env } from '../../config/env.js';

const MODEL_PATH =
  process.env.CHILD_INTAKE_MODEL_PATH ||
  path.join(path.dirname(env.resources.rationRatesPath), 'child_intake_model.json');

let cache = null;
let loadFailed = false;

function load() {
  const artifact = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));

  for (const key of ['features', 'coefficients', 'intercept', 'scaler']) {
    if (artifact[key] === undefined) {
      throw new Error(`Child intake model at ${MODEL_PATH} is missing "${key}"`);
    }
  }
  if (artifact.coefficients.length !== artifact.features.length) {
    throw new Error('Child intake model: coefficient/feature length mismatch');
  }

  console.log(
    `[Intake Model] ${artifact.model_id} v${artifact.schema_version} loaded — ` +
      `alpha ${artifact.alpha}, CV R2 ${artifact.metrics.per_person.cv_r2}, ` +
      `trained on n=${artifact.training_data.n_subjects} Sri Lankan children ` +
      `aged ${artifact.training_data.age_min}-${artifact.training_data.age_max}`,
  );
  return artifact;
}

/** The artifact, or null when it is absent — callers fall back to the rate table. */
export function getModel() {
  if (cache || loadFailed) return cache;
  try {
    cache = load();
  } catch (err) {
    loadFailed = true;
    console.warn(
      `[Intake Model] not available (${err.message}). ` +
        'Falling back to the rate-table child constant.',
    );
  }
  return cache;
}

export function reloadModel() {
  cache = null;
  loadFailed = false;
  return getModel();
}

function isFemale(value) {
  if (value === 2 || value === '2') return true;
  return typeof value === 'string' && value.trim().toUpperCase().startsWith('F');
}

/**
 * Expected kg/day for one child.
 * @returns {{food_kg_day: number, age_extrapolated: boolean}|null}
 */
export function predictChild(age, gender = 'M', province = null) {
  const model = getModel();
  if (!model) return null;

  // Number(null) and Number('') are both 0, which would clamp a person with no
  // recorded age to the youngest trained age and price them as a child. Reject
  // those before coercing, the same way cohortsFromPersons does.
  if (age === null || age === undefined || age === '') return null;
  const years = Number(age);
  if (!Number.isFinite(years) || years < 0) return null;

  const [ageMin, ageMax] = model.age_clamp;
  const clamped = Math.min(Math.max(years, ageMin), ageMax);

  const row = [clamped, isFemale(gender) ? 1 : 0];
  for (const name of model.features.slice(2)) {
    if (province == null) {
      // Unknown province -> national marginal, rather than silently assuming
      // the reference province (which is the highest-intake one).
      row.push(model.province_dummy_means[name] ?? 0);
    } else {
      row.push(name === `province_${province}` ? 1 : 0);
    }
  }

  let kg = model.intercept;
  for (let i = 0; i < row.length; i++) {
    const z = (row[i] - model.scaler.mean[i]) / model.scaler.scale[i];
    kg += model.coefficients[i] * z;
  }

  return {
    food_kg_day: Math.max(0, Math.round(kg * 1000) / 1000),
    age_extrapolated: clamped !== years,
  };
}

/**
 * Expected total kg/day across a list of child records.
 * Returns null when the model is unavailable, so the caller can fall back.
 */
export function predictChildCohort(children = [], province = null) {
  const model = getModel();
  if (!model || !children.length) return null;

  let total = 0;
  let counted = 0;
  let extrapolated = 0;

  for (const child of children) {
    const result = predictChild(child.age, child.gender ?? child.sex ?? 'M', province);
    if (!result) continue;
    total += result.food_kg_day;
    counted += 1;
    if (result.age_extrapolated) extrapolated += 1;
  }
  if (!counted) return null;

  return {
    children: counted,
    food_kg_day: Math.round(total * 10) / 10,
    mean_kg_per_child: Math.round((total / counted) * 1000) / 1000,
    age_extrapolated_count: extrapolated,
    model_id: model.model_id,
    cv_r2: model.metrics.per_person.cv_r2,
  };
}

/** Provenance for the UI and the report. */
export function getModelInfo() {
  const model = getModel();
  if (!model) return null;
  return {
    model_id: model.model_id,
    schema_version: model.schema_version,
    estimator: model.estimator,
    generated_at: model.generated_at,
    generated_by: model.generated_by,
    features: model.features,
    training_data: model.training_data,
    metrics: model.metrics,
    applies_to: model.applies_to,
    caveat: model.caveat,
  };
}
