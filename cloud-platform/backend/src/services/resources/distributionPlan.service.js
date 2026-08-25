/**
 * DistributionPlanService — daily and seven-day food/water requirements.
 *
 * Two components in series:
 *   1. forecastPopulation()   — Theil-Sen trend on registration history (the
 *                               statistical part; genuine uncertainty)
 *   2. dailyRequirement()     — the rate table applied to cohort counts (the
 *                               arithmetic part; a policy constant)
 *
 * The daily ration is deliberately a deterministic rule rather than a fitted
 * regressor. The per-person quantity is a policy constant the platform already
 * issues, and there is no measured variation in camp consumption to learn from.
 * Fitting a regressor to a constant is what produced the R2 ~ 1 artifact in the
 * previous global-dataset model.
 *
 * Scope: food and drinking water only. Shelter units and medical staffing are
 * out of scope and appear nowhere in this pipeline.
 */
import {
  getRates,
  CHILD_MAX_AGE,
  ELDERLY_MIN_AGE,
  ELDERLY_OLD_AGE,
} from './rationRates.service.js';
import { forecastPopulation, DEFAULT_HORIZON } from './populationForecast.service.js';
import { predictChildCohort } from './childIntakeModel.service.js';

function r1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Food and drinking water for one day, for one camp.
 *
 * Supply either head counts (children, elderly) or ratios. Counts win when both
 * are given. Anyone who is neither a child nor elderly is treated as an adult,
 * so adults are always the remainder — never a third input.
 *
 * Children are priced by the trained model when their individual records are
 * available: pass `childrenPeople` (records carrying age and gender) for today,
 * or `childRateOverride` for a projected day, where individuals are not known
 * but the cohort's model-derived mean rate is. Without either, the child
 * rate-table constant applies and `breakdown.children.basis` says so.
 *
 * @returns {{ population, food_kg_day, water_liters_day, breakdown }}
 */
export function dailyRequirement({
  totalPopulation = 0,
  children = null,
  elderly = null,
  pregnant = 0,
  childrenRatio = null,
  elderlyRatio = null,
  childrenPeople = null,
  childRateOverride = null,
  province = null,
  elderly75plus = null,
} = {}) {
  const rates = getRates();

  const pop = Math.max(0, Math.round(Number(totalPopulation) || 0));

  let childCount = children === null || children === undefined
    ? Math.round(pop * (childrenRatio ?? 0))
    : Math.round(Number(children));
  let elderCount = elderly === null || elderly === undefined
    ? Math.round(pop * (elderlyRatio ?? 0))
    : Math.round(Number(elderly));

  // Clamp so cohorts can never be over-specified into negative adults.
  childCount = Math.max(0, Math.min(childCount, pop));
  elderCount = Math.max(0, Math.min(elderCount, pop - childCount));
  const adultCount = Math.max(0, pop - childCount - elderCount);
  const pregnantCount = Math.max(0, Math.min(Math.round(Number(pregnant) || 0), pop));

  // Children: prefer the trained model, then a model-derived cohort rate, then
  // the rate-table constant. Whichever is used is reported in the breakdown.
  let childRate = rates.food_child.value;
  let childBasis = 'rate table constant';
  let modelInfo = null;

  if (Array.isArray(childrenPeople) && childrenPeople.length) {
    const predicted = predictChildCohort(childrenPeople.slice(0, childCount), province);
    if (predicted) {
      childRate = predicted.mean_kg_per_child;
      childBasis = `ML model ${predicted.model_id}`;
      modelInfo = predicted;
    }
  } else if (Number.isFinite(childRateOverride) && childRateOverride > 0) {
    childRate = childRateOverride;
    childBasis = 'ML model (cohort mean carried forward)';
  }

  const foodChildren = childCount * childRate;
  const foodAdults = adultCount * rates.food_adult.value;
  // Elderly split at 75 where the roster allows it. Both bands are measured;
  // without a split, use the population-weighted blend rather than assuming
  // everyone falls in one band.
  let elderOlder = 0;
  let elderYounger = elderCount;
  let foodElderly;
  if (elderly75plus === null || elderly75plus === undefined) {
    foodElderly = elderCount * rates.food_elderly_blended.value;
  } else {
    elderOlder = Math.max(0, Math.min(Math.round(Number(elderly75plus)), elderCount));
    elderYounger = elderCount - elderOlder;
    foodElderly = elderYounger * rates.food_elderly.value
                + elderOlder * rates.food_elderly_75plus.value;
  }
  const elderRateUsed = elderCount ? foodElderly / elderCount : rates.food_elderly.value;
  const foodTopup = pregnantCount * rates.food_pregnant_topup.value;

  // water_pregnant_topup is 0 in the rate table: distribution.json specifies
  // +2 L, but that was defined against the 15 L domestic basis and does not
  // transfer to a 3 L drinking basis without a source.
  const waterTopupRate = rates.water_pregnant_topup?.value ?? 0;
  const waterTotal = pop * rates.water_drinking.value + pregnantCount * waterTopupRate;

  return {
    population: pop,
    food_kg_day: r1(foodChildren + foodAdults + foodElderly + foodTopup),
    water_liters_day: r1(waterTotal),
    meals_per_day: rates.food_adult.meals_per_day ?? 3,
    breakdown: {
      children: {
        count: childCount,
        rate: Math.round(childRate * 1000) / 1000,
        food_kg: r1(foodChildren),
        basis: childBasis,
        ...(modelInfo ? { model: modelInfo } : {}),
      },
      adults: { count: adultCount, rate: rates.food_adult.value, food_kg: r1(foodAdults) },
      elderly: {
        count: elderCount,
        rate: Math.round(elderRateUsed * 1000) / 1000,
        food_kg: r1(foodElderly),
        aged_60_74: elderYounger,
        aged_75plus: elderOlder,
      },
      pregnant_topup: {
        count: pregnantCount,
        rate: rates.food_pregnant_topup.value,
        food_kg: r1(foodTopup),
      },
      water_rate_per_person: rates.water_drinking.value,
    },
    basis: 'deterministic rate table — models/lka_v2/ration_rates.json',
  };
}

/**
 * Seven-day food and water plan.
 *
 * The population path comes from forecastPopulation(); the ration rule is then
 * applied to each projected day, and to the band edges so uncertainty is
 * carried through into kilograms and litres.
 *
 * Demographic ratios are held constant across the horizon — nothing in the
 * available data shows camp composition shifting predictably during an event,
 * so projecting a change would be invention.
 */
export function buildPlan({
  history = [],
  horizonDays = DEFAULT_HORIZON,
  currentPopulation = null,
  childrenRatio = 0,
  elderlyRatio = 0,
  pregnant = 0,
  startDate = null,
  childrenPeople = null,
  province = null,
  elderly75plusRatio = null,
} = {}) {
  const population = forecastPopulation({
    history,
    horizonDays,
    currentPopulation,
    startDate,
  });

  // Price the model once on today's real children, then carry that cohort mean
  // across the horizon. Future days have projected counts, not named people, so
  // the per-child rate is the most the model can legitimately contribute there.
  const todayChildren = Array.isArray(childrenPeople) && childrenPeople.length
    ? predictChildCohort(childrenPeople, province)
    : null;
  const childRateOverride = todayChildren ? todayChildren.mean_kg_per_child : null;

  let foodSum = 0;
  let waterSum = 0;

  const daily = population.daily.map((day) => {
    const elderlyCount = Math.round(day.population * elderlyRatio);
    const cohort = {
      childrenRatio, elderlyRatio, pregnant, childRateOverride, province,
      // Hold the within-elderly age mix constant across the horizon, as with
      // the other demographic ratios.
      elderly75plus: elderly75plusRatio === null
        ? null
        : Math.round(elderlyCount * elderly75plusRatio),
    };
    const mid = dailyRequirement({ totalPopulation: day.population, ...cohort });
    const low = dailyRequirement({ totalPopulation: day.lower, ...cohort });
    const high = dailyRequirement({ totalPopulation: day.upper, ...cohort });

    foodSum += mid.food_kg_day;
    waterSum += mid.water_liters_day;

    return {
      date: day.date,
      day_offset: day.day_offset,
      population: day.population,
      population_low: day.lower,
      population_high: day.upper,
      food_kg_day: mid.food_kg_day,
      water_liters_day: mid.water_liters_day,
      food_kg_low: low.food_kg_day,
      food_kg_high: high.food_kg_day,
      water_liters_low: low.water_liters_day,
      water_liters_high: high.water_liters_day,
    };
  });

  // What a naive headcount x horizon plan would have ordered, for comparison.
  const flat = dailyRequirement({
    totalPopulation: population.current_population,
    childrenRatio,
    elderlyRatio,
    pregnant,
    childRateOverride,
    province,
  });

  return {
    horizon_days: horizonDays,
    daily,
    totals: {
      food_kg: r1(foodSum),
      water_liters: r1(waterSum),
    },
    flat_baseline: {
      food_kg: r1(flat.food_kg_day * horizonDays),
      water_liters: r1(flat.water_liters_day * horizonDays),
      note: 'Current headcount held flat across the horizon — shown so the effect of the trend is visible.',
    },
    population: {
      method: population.method,
      confidence: population.confidence,
      slope_per_day: population.slope_per_day,
      observations: population.observations,
      current_population: population.current_population,
      note: population.note,
    },
    child_model: todayChildren,
  };
}

/**
 * Split a list of live person records into cohort counts by age.
 * Records without a usable age fall into `unknown_age` and are counted as
 * adults by the rule above, which is stated rather than hidden.
 */
export function cohortsFromPersons(persons = []) {
  let children = 0;
  let elderly = 0;
  let elderly75plus = 0;
  let unknown = 0;
  let pregnant = 0;

  for (const person of persons) {
    if (person?.is_pregnant) pregnant++;

    // Number(null) and Number('') are both 0, which would silently record a
    // person with no recorded age as a newborn. Reject those before coercing.
    const raw = person?.age;
    const age = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);

    if (!Number.isFinite(age) || age < 0) unknown++;
    else if (age <= CHILD_MAX_AGE) children++;
    else if (age >= ELDERLY_MIN_AGE) {
      elderly++;
      if (age >= ELDERLY_OLD_AGE) elderly75plus++;
    }
  }

  const total = persons.length;
  return {
    total,
    children,
    elderly,
    elderly_75plus: elderly75plus,
    elderly_60_74: elderly - elderly75plus,
    adults: Math.max(0, total - children - elderly),
    pregnant,
    unknown_age: unknown,
    children_ratio: total > 0 ? children / total : 0,
    elderly_ratio: total > 0 ? elderly / total : 0,
    // Share of the elderly cohort aged 75+, held constant across the forecast.
    elderly_75plus_share: elderly > 0 ? elderly75plus / elderly : 0,
  };
}
