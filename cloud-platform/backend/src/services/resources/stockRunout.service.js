/**
 * Stock runout — when does each commodity run out, and when must we reorder?
 *
 * This is the layer that turns a resource prediction into a decision. The
 * existing inventory check is a LEVEL test (available_quantity <= threshold),
 * which cannot see arrivals: 500 kg of rice reads "fine" against a 100 kg
 * threshold, but with 20 people arriving a day it is two days of food.
 *
 * Runout is a RATE question, so it is answered with the population forecast:
 *
 *     walk the forecast day by day, subtract that day's demand from stock,
 *     and report the first day the balance goes negative.
 *
 * Because the forecast carries a band, the walk runs three times — at the
 * lower, central and upper population — giving an honest runout RANGE rather
 * than a single false-precision date.
 *
 * Demand per commodity = raw food_kg_day x that commodity's share of the
 * basket, both measured from the BRIGHT survey. RAW is deliberate: the store
 * holds raw rice, and subtracting cooked served weight from it over-states the
 * draw-down by about 1.75x. Water is driven by water_liters_day from the ration
 * table, which is already a drinking-water figure and needs no conversion. Anything that is neither food nor water
 * is not consumable on a daily rate and is reported as not forecastable rather
 * than given a fabricated runout date.
 */
import { forecastPopulation } from './populationForecast.service.js';
import { dailyRequirement, cohortsFromPersons } from './distributionPlan.service.js';
import { rawDailyFood } from './rawFoodRates.service.js';
import { shareFor, getShares } from './commodityShares.service.js';
import { env } from '../../config/env.js';

const DEFAULT_HORIZON = 30;

/** Statuses, ordered most severe first. Reuses the vocabulary already in the schema. */
export const STATUS = { CRITICAL: 'CRITICAL', LOW: 'LOW', AVAILABLE: 'AVAILABLE', UNKNOWN: 'UNKNOWN' };

function r1(v) { return Math.round(v * 10) / 10; }
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Classify a resource by what drives its consumption.
 * Returns 'food' | 'water' | null (not consumed at a daily per-person rate).
 */
function demandKind(resource) {
  const cat = String(resource.category || '').toLowerCase();
  const name = String(resource.resource_name || '').toLowerCase();
  if (cat.includes('water') || name.includes('water')) return 'water';
  if (cat.includes('food') || cat.includes('ration') || cat.includes('nutrition')) return 'food';
  // No category recorded: fall back to whether the survey knows the item.
  if (!cat && shareFor(resource.resource_name)) return 'food';
  return null;
}

/**
 * Walk a forecast subtracting daily demand from stock.
 * Returns the 0-based day offset the balance first goes negative, or null.
 */
function walkToEmpty(dailyDemand, stock) {
  let remaining = stock;
  for (let i = 0; i < dailyDemand.length; i++) {
    remaining -= dailyDemand[i];
    if (remaining < 0) return i;
  }
  return null;
}

/**
 * Stock outlook for one camp.
 *
 * @param {object}   o
 * @param {Array}    o.resources          rows from the resources table
 * @param {Array}    o.history            [{date, population}] oldest first
 * @param {number}   o.currentPopulation
 * @param {Array}    [o.persons]          live roster, for cohort counts
 * @param {number}   [o.pregnant]
 * @param {number}   [o.horizonDays]
 * @param {number}   [o.leadTimeDays]     resupply delay; drives reorder_by
 */
export function computeStockOutlook({
  resources = [],
  history = [],
  currentPopulation = 0,
  persons = null,
  pregnant = 0,
  horizonDays = DEFAULT_HORIZON,
  leadTimeDays = env.resources.resupplyLeadTimeDays,
} = {}) {
  const forecast = forecastPopulation({ history, horizonDays, currentPopulation });

  const roster = Array.isArray(persons) ? cohortsFromPersons(persons) : null;
  const cohort = {
    children: roster?.children ?? null,
    elderly: roster?.elderly ?? null,
    elderly75plus: roster?.elderly_75plus ?? null,
    pregnant: pregnant || roster?.pregnant || 0,
  };

  // Food is priced RAW (store basis); water comes from the ration table, which
  // is already litres of drinking water. Scale the roster's cohort mix onto each
  // projected day rather than assuming future arrivals are all adults.
  const scaleRoster = (target) => {
    if (!Array.isArray(persons) || !persons.length) return null;
    const factor = persons.length ? target / persons.length : 0;
    if (!Number.isFinite(factor) || factor <= 0) return null;
    // Repeat the observed roster proportionally to the projected headcount.
    const out = [];
    const whole = Math.floor(factor);
    for (let i = 0; i < whole; i++) out.push(...persons);
    const remainder = Math.round((factor - whole) * persons.length);
    out.push(...persons.slice(0, remainder));
    return out;
  };

  const priceDay = (population) => ({
    food_kg_day: rawDailyFood({
      persons: scaleRoster(population),
      totalPopulation: population,
    }).food_kg_day,
    water_liters_day: dailyRequirement({ totalPopulation: population, ...cohort }).water_liters_day,
  });

  const req = forecast.daily.map((d) => ({
    date: d.date,
    mid: priceDay(d.population),
    low: priceDay(d.lower),
    high: priceDay(d.upper),
  }));

  const day0 = forecast.daily[0]?.date ?? new Date().toISOString().slice(0, 10);

  // Share of the basket already claimed by named commodities, so unmatched
  // food items can split what is genuinely left rather than double-counting.
  const matched = resources.map((r) => (demandKind(r) === 'food' ? shareFor(r.resource_name) : null));
  const claimed = matched.reduce((s, m) => s + (m ? m.share : 0), 0);
  const unmatchedFood = matched.filter((m, i) => demandKind(resources[i]) === 'food' && !m).length;
  const remainderEach = unmatchedFood > 0 ? Math.max(0, 1 - claimed) / unmatchedFood : 0;

  const items = resources.map((resource, i) => {
    const kind = demandKind(resource);
    const stock = Number(resource.available_quantity) || 0;
    const unit = String(resource.unit || '').toLowerCase();

    const base = {
      id: resource.id,
      resource_name: resource.resource_name,
      category: resource.category,
      unit: resource.unit,
      available_quantity: stock,
      minimum_threshold: Number(resource.minimum_threshold) || 0,
    };

    if (!kind) {
      return {
        ...base,
        forecastable: false,
        kind: null,
        commodity_matched: null,
        basket_share: null,
        daily_use_now: null,
        days_cover: null,
        runout_date: null,
        runout_earliest: null,
        runout_latest: null,
        reorder_by: null,
        suggested_order_qty: null,
        status: STATUS.UNKNOWN,
        warnings: [],
        projection: [],
        note: 'Not consumed at a daily per-person rate — no runout date is projected.',
      };
    }

    const match = matched[i];
    const share = kind === 'water' ? null : (match ? match.share : remainderEach);

    const series = req.map((d) => ({
      date: d.date,
      mid: kind === 'water' ? d.mid.water_liters_day : d.mid.food_kg_day * share,
      low: kind === 'water' ? d.low.water_liters_day : d.low.food_kg_day * share,
      high: kind === 'water' ? d.high.water_liters_day : d.high.food_kg_day * share,
    }));

    // Upper population empties the store soonest, so it gives the EARLIEST date.
    const iMid = walkToEmpty(series.map((s) => s.mid), stock);
    const iEarly = walkToEmpty(series.map((s) => s.high), stock);
    const iLate = walkToEmpty(series.map((s) => s.low), stock);

    const perDayNow = series[0]?.mid ?? 0;
    const daysCover = iMid === null
      ? (perDayNow > 0 ? horizonDays : null)
      : iMid;

    const runoutDate = iMid === null ? null : series[iMid].date;
    const reorderBy = runoutDate ? addDays(runoutDate, -leadTimeDays) : null;

    // Forecast-aware status. The old level test could not see arrivals; this
    // compares remaining cover against the time it takes to resupply.
    let status = STATUS.AVAILABLE;
    if (daysCover !== null && daysCover < leadTimeDays) status = STATUS.CRITICAL;
    else if (daysCover !== null && daysCover < leadTimeDays * 2) status = STATUS.LOW;

    const warnings = [];
    if (unit && !['kg', 'l', 'litre', 'liter', 'litres', 'liters'].includes(unit)) {
      warnings.push(
        `Stock is recorded in "${resource.unit}" but demand is modelled in ` +
          `${kind === 'water' ? 'litres' : 'kg'}. Convert the unit or this projection is not comparable.`,
      );
    }
    if (kind === 'food' && !match) {
      warnings.push('No survey commodity matched this name; using an even split of the unallocated basket share.');
    }

    return {
      ...base,
      forecastable: true,
      kind,
      commodity_matched: match ? match.commodity : null,
      basket_share: share === null ? null : Number(share.toFixed(6)),
      daily_use_now: r1(perDayNow),
      days_cover: daysCover,
      runout_date: runoutDate,
      runout_earliest: iEarly === null ? null : series[iEarly].date,
      runout_latest: iLate === null ? null : series[iLate].date,
      reorder_by: reorderBy,
      // How much to order to reach a full horizon of cover.
      suggested_order_qty: r1(Math.max(0, series.reduce((s, d) => s + d.mid, 0) - stock)),
      status,
      warnings,
      projection: series.map((d, k) => ({ date: d.date, required: r1(d.mid), day_offset: k })),
    };
  });

  const order = { CRITICAL: 0, LOW: 1, AVAILABLE: 2, UNKNOWN: 3 };
  items.sort((a, b) => (order[a.status] - order[b.status])
    || ((a.days_cover ?? 1e9) - (b.days_cover ?? 1e9)));

  return {
    generated_at: new Date().toISOString(),
    horizon_days: horizonDays,
    lead_time_days: leadTimeDays,
    as_of: day0,
    population: {
      current: forecast.current_population,
      method: forecast.method,
      confidence: forecast.confidence,
      slope_per_day: forecast.slope_per_day,
      observations: forecast.observations,
      trend_window: forecast.trend_window ?? null,
      note: forecast.note,
      daily: forecast.daily,
    },
    summary: {
      total_items: items.length,
      forecastable: items.filter((i) => i.forecastable).length,
      critical: items.filter((i) => i.status === STATUS.CRITICAL).length,
      low: items.filter((i) => i.status === STATUS.LOW).length,
      next_runout: items.find((i) => i.runout_date)?.runout_date ?? null,
      with_warnings: items.filter((i) => i.warnings?.length).length,
    },
    provenance: {
      food_rates: 'BRIGHT Sri Lanka household survey, raw as-acquired basis (food_rates_raw.json)',
      water_rates: 'Sphere survival drinking water via ration_rates.json',
      commodity_shares: getShares().source,
      population: 'Theil-Sen damped trend on live check-in history',
      basis_note:
        'Food demand is priced on the RAW as-acquired basis, matching what the ' +
        'store holds and procures. The cooked quantities the kitchen serves are ' +
        'a separate figure in ration_rates.json and are not interchangeable.',
    },
    items,
  };
}
