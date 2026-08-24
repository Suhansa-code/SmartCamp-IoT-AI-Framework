/**
 * Tomorrow's resource prediction for the Resources overview page.
 *
 * This used to be a separate model with its own constants — 0.5/0.6/0.5 kg per
 * meal, 15 L of water, a 10 % growth guess and its own confidence tiers. That
 * meant the platform carried TWO food predictions that disagreed with each
 * other: this one and the Distribution planner. Two numbers for the same
 * question is worse than one imperfect number.
 *
 * It is now a thin adapter over the single source of truth:
 *
 *   population  -> populationForecast.service.js  (Theil-Sen damped trend)
 *   quantities  -> distributionPlan.service.js    (measured rate table + the
 *                                                  trained child intake model)
 *
 * The response shape is unchanged so the existing overview page keeps working.
 * Only the numbers behind it changed, and they now match /distribution exactly.
 *
 * Scope is food and drinking water. Shelter units and medical staffing are not
 * produced anywhere in this pipeline.
 */
import { dailyRequirement, cohortsFromPersons } from './distributionPlan.service.js';
import { forecastPopulation } from './populationForecast.service.js';
import { getRates } from './rationRates.service.js';

function r1(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Split a daily food total across the three meals in the proportions the camp
 * actually issues, read from the same production configuration the adult rate
 * comes from. Nothing new is invented here — it is one number, apportioned.
 */
function splitAcrossMeals(foodKg) {
  const rates = getRates();
  const meals = rates.food_adult.meals ?? { breakfast: 0.5, lunch: 0.6, dinner: 0.5 };
  const total = meals.breakfast + meals.lunch + meals.dinner;
  return {
    breakfast_kg: r1(foodKg * (meals.breakfast / total)),
    lunch_kg: r1(foodKg * (meals.lunch / total)),
    dinner_kg: r1(foodKg * (meals.dinner / total)),
  };
}

/**
 * Tomorrow's expected food and water.
 *
 * @param {object}  options
 * @param {Array}   options.snapshots   daily snapshots, oldest first
 * @param {number}  options.totalPersons current headcount
 * @param {Array}   [options.persons]    live roster, for cohort counts
 * @param {number}  [options.pregnant]
 */
export function computePrediction({
  snapshots = [],
  totalPersons = 0,
  persons = null,
  pregnant = 0,
  children = null,
  elderly = null,
  elderly75plus = null,
} = {}) {
  // ── population: the forecaster, not a 10 % growth guess ──────────────────
  const history = snapshots
    .filter((s) => s.date)
    .map((s) => ({ date: s.date, population: s.total_persons }));

  const forecast = forecastPopulation({
    history,
    horizonDays: 2, // today and tomorrow
    currentPopulation: totalPersons,
  });
  const tomorrow = forecast.daily[forecast.daily.length - 1];
  const expectedTotal = tomorrow.population;
  const expectedNew = Math.max(0, expectedTotal - Math.round(totalPersons));

  // ── attendance: measured from history, not assumed ───────────────────────
  const usable = snapshots.filter((s) => s.total_persons > 0 && s.checkins > 0);
  const attendanceRate = usable.length
    ? clamp(
        usable.reduce((sum, s, i) => sum + Math.min(1, s.checkins / s.total_persons) * (i + 1), 0) /
          ((usable.length * (usable.length + 1)) / 2),
        0.5,
        0.99,
      )
    : 0.85;

  const expectedAttending = Math.ceil(expectedTotal * attendanceRate);

  // ── cohorts: derive from the roster when counts were not passed in.
  // Without this everyone is treated as an adult and the overview disagrees
  // with the Distribution page for the same camp.
  const roster = Array.isArray(persons) ? cohortsFromPersons(persons) : null;
  const childCount = children ?? roster?.children ?? null;
  const elderCount = elderly ?? roster?.elderly ?? null;
  const elderOldCount = elderly75plus ?? roster?.elderly_75plus ?? null;
  const pregnantCount = pregnant || roster?.pregnant || 0;

  // ── quantities: the same rule the Distribution planner uses ──────────────
  const scale = expectedTotal > 0 ? expectedAttending / expectedTotal : 0;
  const requirement = dailyRequirement({
    totalPopulation: expectedAttending,
    children: childCount === null ? null : Math.round(childCount * scale),
    elderly: elderCount === null ? null : Math.round(elderCount * scale),
    elderly75plus: elderOldCount === null ? null : Math.round(elderOldCount * scale),
    childrenPeople: persons ? persons.filter((p) => {
      const age = p?.age;
      return age !== null && age !== undefined && age !== '' && Number(age) <= 17;
    }) : null,
    pregnant: pregnantCount,
  });

  const notes = [];
  if (pregnantCount > 0) notes.push(`${pregnantCount} pregnant (+${getRates().food_pregnant_topup.value} kg each)`);
  if (forecast.confidence === 'LOW') notes.push('Low confidence — fewer than 3 days of history');
  notes.push('Same model as the Distribution planner');

  return {
    expected_persons: expectedAttending,
    expected_new_arrivals: expectedNew,
    attendance_rate_pct: Math.round(attendanceRate * 100),
    ...splitAcrossMeals(requirement.food_kg_day),
    food_kg: requirement.food_kg_day,
    water_litres: requirement.water_liters_day,
    confidence: forecast.confidence,
    days_of_data: forecast.observations,
    forecast_method: forecast.method,
    breakdown: requirement.breakdown,
    note: notes.join(' · '),
  };
}
