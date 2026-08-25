/**
 * PopulationForecastService — seven-day camp population forecast.
 *
 * This is the only genuinely statistical component of the resource model; the
 * ration calculation downstream of it is deterministic.
 *
 * Why a robust trend fit and not a time-series model: camp registration history
 * is short and spiky. A camp open a week has seven observations, and disaster
 * intake arrives in bursts. Ordinary least squares chases a single mass-arrival
 * day; Theil-Sen takes the median of all pairwise slopes and ignores it.
 *
 * Honest cold start: below MIN_DAYS_FOR_TREND observations there is no trend to
 * estimate, so the population is held flat and the result says so through the
 * confidence field. A flat multiplication is never reported as a fit.
 *
 * Port of prediction-models/src/population_forecast.py — keep the two in step.
 * One deliberate difference: JS Math.round breaks ties upward while Python's
 * round() is banker's rounding, so a projected 232.5 becomes 233 here and 232
 * there. Rounding up is the safer direction for a provisioning figure.
 */

// Below this many observations there is no trend to estimate.
export const MIN_DAYS_FOR_TREND = 3;
// At or above this many observations a residual spread can be estimated too.
export const MIN_DAYS_FOR_BAND = 7;

export const DEFAULT_HORIZON = 7;

// Unbounded linear growth over a week is not credible. Cap projected growth at
// this multiple of the current headcount across the full horizon.
export const MAX_HORIZON_GROWTH_FACTOR = 3.0;

// Damping factor on the projected trend (Gardner-McKenzie damped trend).
//
// Rolling-origin back-testing (prediction-models/scripts/backtest_forecast.py)
// showed an undamped linear projection is BEATEN BY assuming no change at all:
// camp intake saturates, so a slope fitted on the steep middle of the curve
// keeps growing after arrivals have stopped. Damping multiplies the slope by
// phi^i for each day i ahead. Over 200 synthetic camps x 21 days at h=7:
//
//   phi 1.00 -> MAE 3061, bias  +867   (worse than flat)
//   phi 0.80 -> MAE 2024, bias -1116   <- default
//   phi 0.70 -> MAE 1906, bias -1643   (best MAE, under-orders most)
//   flat     -> MAE 2748, bias -2748
//
// 0.8 is chosen over the MAE-optimal 0.7 because under-prediction means the
// camp runs short, the more costly error. Set to 1.0 to disable damping.
export const TREND_DAMPING = 0.8;

// ── helpers ────────────────────────────────────────────────────────────────

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median of all pairwise slopes. Robust to mass-arrival outlier days. */
function theilSenSlope(xs, ys) {
  const slopes = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  return slopes.length ? median(slopes) : 0;
}

function theilSenIntercept(xs, ys, slope) {
  return median(ys.map((y, i) => y - slope * xs[i]));
}

/** Median absolute residual — the band half-width per projected day. */
function residualSpread(xs, ys, slope, intercept) {
  return median(ys.map((y, i) => Math.abs(y - (slope * xs[i] + intercept))));
}

function toDayNumber(isoDate) {
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);
}

function fromDayNumber(dayNumber) {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Accept [{ date, population }] and return day-offset / population arrays
 * sorted by date, one row per calendar day (last reading of each day wins).
 */
function normaliseHistory(history) {
  const byDay = new Map();
  for (const item of history) {
    const date = typeof item.date === 'string' ? item.date.slice(0, 10) : item.date;
    const population = Number(item.population);
    if (!date || !Number.isFinite(population)) continue;
    byDay.set(date, population);
  }

  const days = [...byDay.keys()].sort();
  if (!days.length) return { days: [], xs: [], ys: [] };

  const origin = toDayNumber(days[0]);
  return {
    days,
    xs: days.map((d) => toDayNumber(d) - origin),
    ys: days.map((d) => byDay.get(d)),
  };
}

// ── public API ─────────────────────────────────────────────────────────────

/**
 * Project camp population forward day by day.
 *
 * @param {object}  options
 * @param {Array}   options.history            — [{ date: 'YYYY-MM-DD', population }]
 * @param {number}  options.horizonDays        — days to project, including day 0
 * @param {number}  [options.currentPopulation] — override for today's headcount
 * @param {string}  [options.startDate]        — day 0; defaults to the last observed day
 * @param {number}  [options.damping]          — trend damping phi (1.0 disables)
 * @returns {{ daily, method, confidence, slope_per_day, observations, note }}
 */
export function forecastPopulation({
  history = [],
  horizonDays = DEFAULT_HORIZON,
  currentPopulation = null,
  startDate = null,
  damping = TREND_DAMPING,
} = {}) {
  const { days, xs, ys } = normaliseHistory(history);
  const n = days.length;

  const current = Number.isFinite(currentPopulation)
    ? Number(currentPopulation)
    : (ys.length ? ys[ys.length - 1] : 0);

  const start = startDate ?? (days.length ? days[days.length - 1] : new Date().toISOString().slice(0, 10));
  const startDay = toDayNumber(start);

  // ── choose an estimator honestly, based on what the data supports ────────
  let slope = 0;
  let spread = 0;
  let method;
  let confidence;
  let note;

  if (n < MIN_DAYS_FOR_TREND) {
    method = 'flat_hold';
    confidence = 'LOW';
    note =
      `Only ${n} day(s) of registration history — too few to estimate a trend. ` +
      'Population held flat at the current headcount. This is a cold-start ' +
      'fallback, not a fitted forecast.';
  } else {
    slope = theilSenSlope(xs, ys);
    const intercept = theilSenIntercept(xs, ys, slope);

    if (n >= MIN_DAYS_FOR_BAND) {
      spread = residualSpread(xs, ys, slope, intercept);
      method = 'theil_sen_with_band';
      confidence = 'HIGH';
      note =
        `Theil-Sen trend fitted on ${n} days of registration history ` +
        `(${slope >= 0 ? '+' : ''}${slope.toFixed(2)} persons/day), with a band ` +
        'from the median absolute residual.';
    } else {
      method = 'theil_sen';
      confidence = 'MEDIUM';
      note =
        `Theil-Sen trend fitted on ${n} days of registration history ` +
        `(${slope >= 0 ? '+' : ''}${slope.toFixed(2)} persons/day). Fewer than ` +
        `${MIN_DAYS_FOR_BAND} observations, so no uncertainty band is reported.`;
    }
  }

  const ceiling = current * MAX_HORIZON_GROWTH_FACTOR;

  const daily = [];
  for (let offset = 0; offset < horizonDays; offset++) {
    // Damped trend: each day ahead contributes phi^i of the fitted slope, so
    // the projection flattens instead of extrapolating forever.
    let displacement = 0;
    for (let i = 1; i <= offset; i++) displacement += slope * damping ** i;
    let projected = current + displacement;
    projected = ceiling > 0 ? Math.min(Math.max(0, projected), ceiling) : Math.max(0, projected);

    const half = spread * (1 + offset * 0.5); // band widens with horizon
    daily.push({
      date: fromDayNumber(startDay + offset),
      day_offset: offset,
      population: Math.round(projected),
      lower: Math.round(Math.max(0, projected - half)),
      upper: Math.round(projected + half),
    });
  }

  if (ceiling > 0 && daily.some((d) => d.population >= ceiling)) {
    note += ` Growth capped at ${MAX_HORIZON_GROWTH_FACTOR}x the current headcount over the horizon.`;
  }

  return {
    daily,
    method,
    confidence,
    slope_per_day: Math.round(slope * 1000) / 1000,
    observations: n,
    damping,
    horizon_days: horizonDays,
    current_population: Math.round(current),
    note,
  };
}
