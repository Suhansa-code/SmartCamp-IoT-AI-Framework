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
 *
 * ── Standardisation runs before any of that ────────────────────────────────
 *
 * Every store line goes through commodityStandardizer.service.js first, which
 * reduces it to a canonical key and gives it a class. That decides two things
 * this file used to guess at:
 *
 *   what KIND of demand drives it   was: substring tests on category and name,
 *                                   which read "Milk" in category "Beverage" as
 *                                   non-consumable and gave it no runout date
 *   which SHARE it is entitled to   was: substring containment, which missed
 *                                   "Milk Powder" and invented "Ice" -> rice
 *
 * The unallocated remainder is still the fallback for a genuine food item the
 * survey has no line for (eggs, curry powder), but it is now a much smaller and
 * more honest quantity, and an item is never handed a slice of it merely
 * because a spelling defeated a substring test. Beverages and non-foods are
 * excluded from the remainder split entirely: they are not basket items, and
 * splitting the basket across them is the double count the beverage exclusion
 * in commodity_shares.json was built to prevent.
 */
import { forecastPopulation } from './populationForecast.service.js';
import { dailyRequirement, cohortsFromPersons } from './distributionPlan.service.js';
import { rawDailyFood } from './rawFoodRates.service.js';
import { shareFor, getShares, classifyResource } from './commodityShares.service.js';
import { CLASS, getAliasProvenance } from './commodityStandardizer.service.js';
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
 * Classify a resource by what drives its consumption, and match its share.
 *
 * Both answers come from one standardisation pass, so the class and the share
 * can never disagree about what an item is.
 *
 * Precedence, and why each rung sits where it does:
 *
 *   1. water        Either the operator's category or the alias table says
 *                   water. Decided first because getting it wrong is a UNIT
 *                   error — litres of drinking water priced as kilograms of
 *                   food — which is worse than any share error below it.
 *   2. refusal      An explicit non-food or an excluded beverage. Ahead of the
 *                   food category on purpose: a row categorised FOOD but named
 *                   "Tarpaulin" or "Tea" fails CLOSED, reporting nothing,
 *                   rather than inventing a runout date for a tarpaulin or
 *                   double-counting tea against the water allowance.
 *   3. food         The operator's category, the alias table, or a hit in the
 *                   shares table. The last of those is what fixes "Milk" filed
 *                   under category "Beverage": the category is not food, but
 *                   the survey prices powdered and fresh milk, so it is food
 *                   and now gets a runout date instead of silence.
 *   4. null         Nothing recognises it. Reported as not forecastable, with
 *                   the standardisation attached so the operator can see the
 *                   canonical form that failed and fix the name or the table.
 *
 * @returns {{ kind: 'food'|'water'|null, std: object, match: object|null }}
 */
function classifyDemand(resource) {
  const cat = String(resource.category || '').toLowerCase();
  const { standardized, match } = classifyResource(resource.resource_name);

  if (cat.includes('water') || standardized.klass === CLASS.WATER) {
    return { kind: 'water', std: standardized, match: null };
  }
  if (standardized.klass === CLASS.NON_FOOD || standardized.klass === CLASS.BEVERAGE) {
    return { kind: null, std: standardized, match: null };
  }
  if (cat.includes('food') || cat.includes('ration') || cat.includes('nutrition')) {
    return { kind: 'food', std: standardized, match };
  }
  if (standardized.klass === CLASS.FOOD || match) {
    return { kind: 'food', std: standardized, match };
  }
  return { kind: null, std: standardized, match: null };
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

  // ── standardise once, up front ──────────────────────────────────────────
  //
  // Every downstream decision reads from this one pass. Standardising inside
  // the item loop instead would mean classifying each name twice — once to
  // compute the remainder, once to price it — and nothing would keep the two
  // passes agreeing if the precedence rules changed.
  const classified = resources.map(classifyDemand);

  // Share of the basket already claimed by named commodities, so unmatched
  // food items can split what is genuinely left rather than double-counting.
  //
  // A group alias claims the sum of its members, and a member cannot be claimed
  // twice: if the store lists both "Rice" (white + red) and "Red rice", the
  // group and the single line would otherwise both count red rice and over-
  // state the claimed share, shrinking the remainder every other item shares.
  const claimedCommodities = new Set();
  let claimed = 0;
  for (const c of classified) {
    if (c.kind !== 'food' || !c.match) continue;
    for (const name of c.match.commodities) {
      if (claimedCommodities.has(name)) continue;
      claimedCommodities.add(name);
      claimed += getShares().shares[name] ?? 0;
    }
  }

  // Only genuine food items with no match split the remainder. Beverages and
  // non-foods are excluded by classifyDemand before they ever reach here.
  const unmatchedFood = classified.filter((c) => c.kind === 'food' && !c.match).length;
  const unallocated = Math.max(0, 1 - claimed);
  const remainderEach = unmatchedFood > 0 ? unallocated / unmatchedFood : 0;

  const items = resources.map((resource, i) => {
    const { kind, std, match } = classified[i];
    const stock = Number(resource.available_quantity) || 0;
    const unit = String(resource.unit || '').toLowerCase();

    // How the raw store line was read, carried on every item so the operator
    // can audit a wrong number without reading the source. `canonical` is the
    // key both sides of the match were reduced to; `rule` names the stage that
    // fired, or why the item was refused.
    const standardisation = {
      raw_name: resource.resource_name,
      canonical_name: std.canonical || null,
      classified_as: std.klass,
      class_rule: std.rule,
      class_note: std.note,
      match_rule: match ? match.match : null,
      match_confidence: match ? match.confidence : null,
    };

    const base = {
      id: resource.id,
      resource_name: resource.resource_name,
      category: resource.category,
      unit: resource.unit,
      available_quantity: stock,
      minimum_threshold: Number(resource.minimum_threshold) || 0,
      standardisation,
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
        // Say WHICH of the three reasons applies. "Not forecastable" alone sent
        // the operator hunting for a bug when the honest answer was "this is a
        // blanket", "tea is excluded on purpose", or "nothing recognises this
        // name — check the spelling or add an alias".
        note: std.klass === CLASS.NON_FOOD
          ? `Recognised as a non-consumable ("${std.canonical}"). No daily per-person draw rate applies, so no runout date is projected.`
          : std.klass === CLASS.BEVERAGE
            ? `"${std.canonical}" is a beverage. The food basket excludes beverages by construction, because drinking water is provisioned separately — giving this item a food share would double-count it against the water allowance.`
            : `Nothing recognises "${std.canonical}" as food, water or a known non-consumable, and it has no food category. Set its category, or add an alias to commodity_aliases.json.`,
      };
    }

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
      warnings.push(
        `No survey commodity matched "${std.canonical}", so this item is using an even ` +
          `split of the unallocated basket share (${(unallocated * 100).toFixed(1)} % across ` +
          `${unmatchedFood} item${unmatchedFood === 1 ? '' : 's'}). That is a placeholder, not a ` +
          'measurement — add an alias to commodity_aliases.json to price it properly.',
      );
    }
    // A word-level match is a good guess, not a stated mapping. Say so, rather
    // than letting a medium-confidence match read like a measured one.
    if (kind === 'food' && match && match.confidence !== 'high') {
      warnings.push(
        `Matched to "${match.commodity}" by ${match.match.replace('_', ' ')} — the words line up, ` +
          'but no exact name or curated alias confirms it. Check the mapping if the draw rate looks wrong.',
      );
    }

    return {
      ...base,
      forecastable: true,
      kind,
      commodity_matched: match ? match.commodity : null,
      // The full group behind a summed share. "Rice" is drawn down by everyone
      // eating white rice AND red rice; showing only the largest member would
      // make a 31.4 % share look like it came from a 23.5 % commodity.
      commodities_matched: match ? match.commodities : null,
      basket_share: share === null ? null : Number(share.toFixed(6)),
      basket_share_source: kind === 'water'
        ? 'not applicable — water is priced from the ration table'
        : match ? `matched (${match.match})` : 'unallocated remainder, split evenly',
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

    // ── How the basket was divided up ────────────────────────────────────
    //
    // Exposed because it is the single best health check on the matching
    // layer. A high `unallocated_share` with several `unmatched_food` items
    // means the store is stocking things the survey never priced, and every
    // one of those items is running on a placeholder rate. A UI can show this
    // directly; without it, a fabricated share is indistinguishable from a
    // measured one.
    allocation: {
      claimed_share: Number(claimed.toFixed(6)),
      unallocated_share: Number(unallocated.toFixed(6)),
      commodities_claimed: claimedCommodities.size,
      commodities_available: Object.keys(getShares().shares).length,
      unmatched_food: unmatchedFood,
      remainder_each: Number(remainderEach.toFixed(6)),
      by_rule: classified.reduce((acc, c) => {
        const key = c.kind === 'water' ? 'water'
          : c.kind === null ? `unforecastable:${c.std.klass}`
          : c.match ? c.match.match
          : 'unmatched_remainder';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      note:
        'Shares are claimed once per commodity: a group alias and a single line ' +
        'naming the same commodity do not both count it. Whatever is left is split ' +
        'evenly across food items the survey has no line for.',

      // ── An open modelling question, stated rather than silently decided ──
      //
      // A camp store holds a NARROWER basket than the households the shares
      // were measured on. With no unmatched food items to absorb it, the
      // unclaimed share is simply not drawn from anything: the per-item draws
      // sum to `claimed_share` of food_kg_day, and the rest has no home.
      //
      // Two readings, and they give materially different runout dates:
      //
      //   as-is (implemented)  demand for unstocked items is met elsewhere or
      //                        goes unmet. Rice draws its measured 31.4 %.
      //   substitution         people eat more of what IS stocked. Rice would
      //                        draw 31.4/55.2 = 57 %, nearly doubling its draw
      //                        rate and roughly halving days of cover.
      //
      // Renormalising is NOT done here, because nothing measured says camps
      // substitute rather than go short, and doubling every draw rate on an
      // unevidenced assumption would be the more dangerous error. The figure is
      // reported so the choice is visible and can be revisited with data.
      unstocked_share_note: unmatchedFood === 0 && unallocated > 0.05
        ? `${(unallocated * 100).toFixed(1)} % of the measured food basket is not stocked by any ` +
          'line in this store, so no item is drawn down for it. Per-item demand therefore sums to ' +
          `${(claimed * 100).toFixed(1)} % of total food_kg_day. Shares are NOT renormalised onto ` +
          'the stocked items: that would assume substitution, which nothing in the data supports, ' +
          'and it would roughly halve every days-of-cover figure.'
        : null,
    },

    provenance: {
      food_rates: 'BRIGHT Sri Lanka household survey, raw as-acquired basis (food_rates_raw.json)',
      water_rates: 'Sphere survival drinking water via ration_rates.json',
      commodity_shares: getShares().source,
      commodity_aliases: getAliasProvenance(),
      population: 'Theil-Sen damped trend on live check-in history',
      basis_note:
        'Food demand is priced on the RAW as-acquired basis, matching what the ' +
        'store holds and procures. The cooked quantities the kitchen serves are ' +
        'a separate figure in ration_rates.json and are not interchangeable.',
      matching_note:
        'Store names are standardised before matching: lowercased, stripped of ' +
        'pack sizes and parentheticals, singularised and token-sorted, then ' +
        'resolved through a curated alias table. Matching compares WORDS, not ' +
        'substrings, so a name can no longer match a commodity it merely ' +
        'contains the letters of. Each item reports the stage that matched it.',
    },
    items,
  };
}
