"""
population_forecast.py

Seven-day camp population forecast.

This is the only genuinely statistical component of the resource model. The
ration calculation downstream of it is deterministic (see lka_resource_predictor).

Why a robust trend fit and not a time-series model:

    Camp registration history is short and spiky. A camp that has been open a
    week has seven observations, and disaster intake arrives in bursts rather
    than smoothly. Ordinary least squares chases a single mass-arrival day;
    Theil-Sen takes the median of all pairwise slopes and ignores it. Anything
    with more parameters than that would be fitting noise.

Honest cold start: with fewer than MIN_DAYS_FOR_TREND observations there is no
trend to estimate, so the forecast holds the current headcount flat and says so
via the confidence field. It never presents a flat multiplication as a fit.

Usage:

    from src.population_forecast import forecast_population

    result = forecast_population(
        history=[(date(2026, 8, 14), 120), (date(2026, 8, 15), 143), ...],
        horizon_days=7,
    )
    result["confidence"]           # 'LOW' | 'MEDIUM' | 'HIGH'
    result["daily"][0]["population"]
"""

import logging
from datetime import date, timedelta
from itertools import combinations
from statistics import median

logger = logging.getLogger(__name__)

# Below this many observations there is no trend to estimate.
MIN_DAYS_FOR_TREND = 3
# At or above this many observations a residual spread can be estimated too.
MIN_DAYS_FOR_BAND  = 7

DEFAULT_HORIZON = 7

# A camp cannot lose more than its whole population, and unbounded linear
# growth over a week is not credible either. Cap projected growth at this
# multiple of the current headcount over the full horizon.
MAX_HORIZON_GROWTH_FACTOR = 3.0

# Damping factor on the projected trend (Gardner-McKenzie damped trend).
#
# Rolling-origin back-testing (scripts/backtest_forecast.py) showed that an
# undamped linear projection is BEATEN BY assuming no change at all: camp intake
# saturates -- people arrive fast then stop -- so a slope fitted on the steep
# middle of the curve keeps growing after arrivals have stopped. At h=7 the
# undamped estimator over-predicted by +867 people on average and scored a worse
# MAE than the flat baseline.
#
# Damping multiplies the slope by phi^i for each day i ahead, so the projection
# flattens as it extends. Measured over 200 synthetic camps x 21 days:
#
#   phi    MAE h=7   MAPE h=7    bias h=7
#   1.00    3061.0      53.9 %     +866.7   (worse than flat)
#   0.90    2408.9      39.5 %     -323.5
#   0.80    2023.7      30.9 %    -1115.8   <- default
#   0.70    1906.4      27.6 %    -1642.5   (best MAE, but under-orders most)
#   flat    2748.3      38.7 %    -2748.3
#
# 0.8 is chosen over the MAE-optimal 0.7 because under-prediction means a camp
# runs short, which is the more costly error. Set to 1.0 to disable damping.
TREND_DAMPING = 0.8

# Fit the trend on this many trailing days rather than the whole history.
#
# A camp's history contains its intake ramp -- a steep rise from zero over the
# first days. Theil-Sen takes the median of ALL pairwise slopes, so once the
# camp starts emptying those ramp pairs keep dragging the fitted slope upward
# and the forecast projects growth for a camp that is demobilising. Measured
# over 60 heterogeneous synthetic camps (4 trajectory archetypes, per-camp
# decay rates drawn around the PDNA national figure):
#
#   window   MAE h=7   MAPE h=7   bias h=7
#   all        53.07     64.6 %    +34.28
#   10         49.74     59.2 %    +30.84
#   7          47.33     55.0 %    +28.10   <- default
#   5          44.73     51.3 %    +24.95
#
# Shorter windows score better still, but 7 is chosen to match
# MIN_DAYS_FOR_BAND: the residual band needs that many points to mean anything,
# and a one-week window is what an operator would call "recent". Set to None to
# fit on the entire history.
TREND_WINDOW_DAYS = 7



def _theil_sen_slope(xs, ys) -> float:
    """Median of pairwise slopes. Robust to mass-arrival outlier days."""
    slopes = [(ys[j] - ys[i]) / (xs[j] - xs[i])
              for i, j in combinations(range(len(xs)), 2)
              if xs[j] != xs[i]]
    return median(slopes) if slopes else 0.0


def _theil_sen_intercept(xs, ys, slope: float) -> float:
    return median([y - slope * x for x, y in zip(xs, ys)])


def _residual_spread(xs, ys, slope: float, intercept: float) -> float:
    """Median absolute residual — the band half-width per projected day."""
    resid = [abs(y - (slope * x + intercept)) for x, y in zip(xs, ys)]
    return median(resid) if resid else 0.0


def _normalise_history(history):
    """
    Accept [(date, population), ...] or [{'date': ..., 'population': ...}, ...]
    and return day-offset / population lists sorted by date, one row per date.
    """
    rows = []
    for item in history:
        if isinstance(item, dict):
            d, pop = item["date"], item["population"]
        else:
            d, pop = item
        if isinstance(d, str):
            d = date.fromisoformat(d)
        rows.append((d, float(pop)))

    # One observation per calendar day; keep the last reading of each day.
    by_day = {}
    for d, pop in sorted(rows, key=lambda r: r[0]):
        by_day[d] = pop

    days = sorted(by_day)
    if not days:
        return [], [], []

    origin = days[0]
    xs = [float((d - origin).days) for d in days]
    ys = [by_day[d] for d in days]
    return days, xs, ys



def forecast_population(history, horizon_days: int = DEFAULT_HORIZON,
                        current_population: int = None,
                        start_date: date = None,
                        damping: float = TREND_DAMPING) -> dict:
    """
    Project camp population forward day by day.

    Args:
        history            — observed (date, population) pairs. May be empty.
        horizon_days       — days to project, including day 0 (default 7).
        current_population — override for today's headcount. Defaults to the
                             last observation in history.
        start_date         — day 0 of the forecast. Defaults to the last
                             observed date, or today if history is empty.
        damping            — trend damping factor phi (1.0 disables damping).

    Returns a dict with:
        daily        — list of {date, day_offset, population, lower, upper}
        method       — which estimator was used
        confidence   — 'LOW' | 'MEDIUM' | 'HIGH'
        slope_per_day— fitted arrivals per day (0.0 when held flat)
        observations — number of distinct days used
        note         — plain-English statement of what was and was not fitted
    """
    days, xs, ys = _normalise_history(history or [])
    # Confidence is judged on everything observed; the trend is fitted only on
    # the trailing window, so the intake ramp stops biasing a demobilising camp.
    n = len(days)
    if TREND_WINDOW_DAYS and len(xs) > TREND_WINDOW_DAYS:
        xs, ys = xs[-TREND_WINDOW_DAYS:], ys[-TREND_WINDOW_DAYS:]

    if current_population is None:
        current_population = ys[-1] if ys else 0.0
    current_population = float(current_population)

    if start_date is None:
        start_date = days[-1] if days else date.today()

    # ---- choose an estimator honestly based on what the data supports ----
    if n < MIN_DAYS_FOR_TREND:
        slope, spread = 0.0, 0.0
        method     = "flat_hold"
        confidence = "LOW"
        note = (f"Only {n} day(s) of registration history — too few to estimate a "
                f"trend. Population held flat at the current headcount. This is a "
                f"cold-start fallback, not a fitted forecast.")
    else:
        slope     = _theil_sen_slope(xs, ys)
        intercept = _theil_sen_intercept(xs, ys, slope)
        if n >= MIN_DAYS_FOR_BAND:
            spread     = _residual_spread(xs, ys, slope, intercept)
            method     = "theil_sen_with_band"
            confidence = "HIGH"
            note = (f"Theil-Sen trend fitted on the last {len(xs)} of {n} days of "
                    f"registration history ({slope:+.2f} persons/day), with a band "
                    f"from the median absolute residual.")
        else:
            spread     = 0.0
            method     = "theil_sen"
            confidence = "MEDIUM"
            note = (f"Theil-Sen trend fitted on {n} days of registration history "
                    f"({slope:+.2f} persons/day). Fewer than {MIN_DAYS_FOR_BAND} "
                    f"observations, so no uncertainty band is reported.")

    ceiling = current_population * MAX_HORIZON_GROWTH_FACTOR

    daily = []
    for offset in range(horizon_days):
        # Damped trend: each day ahead contributes phi^i of the fitted slope,
        # so the projection flattens instead of extrapolating forever.
        displacement = slope * sum(damping ** i for i in range(1, offset + 1))
        projected = current_population + displacement
        projected = max(0.0, min(projected, ceiling)) if ceiling > 0 else max(0.0, projected)

        half = spread * (1 + offset * 0.5)   # band widens with horizon
        daily.append({
            "date":       (start_date + timedelta(days=offset)).isoformat(),
            "day_offset": offset,
            "population": int(round(projected)),
            "lower":      int(round(max(0.0, projected - half))),
            "upper":      int(round(projected + half)),
        })

    capped = any(d["population"] >= ceiling and ceiling > 0 for d in daily)
    if capped:
        note += (f" Growth capped at {MAX_HORIZON_GROWTH_FACTOR:g}x the current "
                 f"headcount over the horizon.")

    return {
        "daily":            daily,
        "method":           method,
        "confidence":       confidence,
        "slope_per_day":    round(slope, 3),
        "observations":     n,
        "trend_window":     len(xs),
        "damping":          damping,
        "horizon_days":     horizon_days,
        "current_population": int(round(current_population)),
        "note":             note,
    }


def history_from_checkins(rows) -> list:
    """
    Turn camp_checkins rows into cumulative-population history.

    Args:
        rows — iterable of (checkin_date, new_arrivals) already grouped by day,
               ordered oldest first, as produced by:

                   SELECT date(checkin_time) AS d, COUNT(*) AS n
                   FROM camp_checkins
                   WHERE is_new_arrival = 1
                   GROUP BY d ORDER BY d

    Returns [(date, cumulative_population), ...] suitable for
    forecast_population().
    """
    history, running = [], 0
    for d, n in rows:
        if isinstance(d, str):
            d = date.fromisoformat(d)
        running += int(n)
        history.append((d, running))
    return history


# ----------------------------------------------------------------------
# Quick test — run directly:  python src/population_forecast.py
# ----------------------------------------------------------------------
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    scenarios = [
        ("Cold start — 1 day of history",
         [(date(2026, 8, 20), 40)]),
        ("Three days, steady intake",
         [(date(2026, 8, 18), 40), (date(2026, 8, 19), 55), (date(2026, 8, 20), 70)]),
        ("Ten days with one mass-arrival spike",
         [(date(2026, 8, 11) + timedelta(days=i), p) for i, p in
          enumerate([20, 28, 35, 44, 52, 61, 400, 78, 86, 95])]),
    ]

    for label, hist in scenarios:
        r = forecast_population(hist, horizon_days=7)
        print(f"\n{label}")
        print(f"  method={r['method']}  confidence={r['confidence']}  "
              f"slope={r['slope_per_day']:+.2f}/day  n={r['observations']}")
        print(f"  {r['note']}")
        path = " -> ".join(str(d["population"]) for d in r["daily"])
        print(f"  7-day population: {path}")
