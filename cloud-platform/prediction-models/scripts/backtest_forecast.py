"""
backtest_forecast.py

Rolling-origin back-test of the seven-day population forecaster.

Method
------
For each synthetic camp history of N days, and each origin t from
MIN_DAYS_FOR_TREND to N-1:

    fit on days[0..t]  ->  predict days[t+1 .. t+7]  ->  compare with actual

Every prediction is therefore made using only data available at the time it
would have been made. Errors are aggregated per horizon step h = 1..7, so the
report shows how accuracy decays as the forecast reaches further out.

Baselines
---------
    flat  — tomorrow equals today. This is the honest null: it is what a planner
            does with no model at all, and what the forecaster falls back to
            below three observations. Beating it is the minimum bar.
    ols   — ordinary least squares on the same window. Included to test the
            specific claim that Theil-Sen is more robust to mass-arrival bursts.

What this measures
------------------
Whether the estimator recovers a trend from data with known properties, and how
it behaves under noise and bursts. It does NOT measure field accuracy: the
curves are synthetic (see generate_camp_registrations.py). Report it as
estimator validation.
"""

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from population_forecast import forecast_population, MIN_DAYS_FOR_TREND  # noqa: E402
from generate_camp_registrations import generate_history, empirical_profile  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))

HORIZON = 7


def _ols_slope(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    denom = sum((x - mx) ** 2 for x in xs)
    return 0.0 if denom == 0 else sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom


def predict(method, window):
    """Return a function offset -> projected population, fitted on `window`."""
    ys = [row["population"] for row in window]
    xs = list(range(len(ys)))
    current = ys[-1]

    if method == "flat":
        return lambda h: current
    if method == "ols":
        slope = _ols_slope(xs, ys)
        return lambda h: max(0.0, current + slope * h)
    if method == "theil_sen_undamped":
        result = forecast_population(window, horizon_days=HORIZON + 1, damping=1.0)
        path = [d["population"] for d in result["daily"]]
        return lambda h: path[h] if h < len(path) else path[-1]
    if method == "theil_sen":
        # The shipped model, damping and all.
        result = forecast_population(window, horizon_days=HORIZON + 1)
        path = [d["population"] for d in result["daily"]]
        return lambda h: path[h] if h < len(path) else path[-1]
    raise ValueError(method)


def backtest(camps, methods=("theil_sen", "theil_sen_undamped", "flat", "ols")):
    """errors[method][h] = list of (predicted, actual) pairs."""
    errors = {m: {h: [] for h in range(1, HORIZON + 1)} for m in methods}

    for camp in camps:
        history = camp["history"]
        n = len(history)
        for t in range(MIN_DAYS_FOR_TREND - 1, n - 1):
            window = history[: t + 1]
            for method in methods:
                project = predict(method, window)
                for h in range(1, HORIZON + 1):
                    if t + h >= n:
                        break
                    errors[method][h].append(
                        (project(h), history[t + h]["population"])
                    )
    return errors


def summarise(errors):
    """Per-horizon MAE, MAPE and signed bias for each method."""
    rows = []
    for method, by_h in errors.items():
        for h, pairs in sorted(by_h.items()):
            if not pairs:
                continue
            pred = np.array([p for p, _ in pairs], dtype=float)
            act = np.array([a for _, a in pairs], dtype=float)
            nonzero = act > 0
            rows.append({
                "method": method,
                "horizon": h,
                "n": len(pairs),
                "mae": float(np.mean(np.abs(pred - act))),
                # MAPE is only defined where the camp is non-empty.
                "mape": float(np.mean(np.abs(pred[nonzero] - act[nonzero]) / act[nonzero]) * 100)
                        if nonzero.any() else float("nan"),
                "bias": float(np.mean(pred - act)),
            })
    return rows


def print_table(rows, title):
    print(f"\n{title}")
    print(f"  {'method':<11}{'h':>3}{'n':>7}{'MAE':>10}{'MAPE %':>9}{'bias':>10}")
    print("  " + "-" * 50)
    for method in ("theil_sen", "theil_sen_undamped", "ols", "flat"):
        for row in [r for r in rows if r["method"] == method]:
            print(f"  {row['method']:<11}{row['horizon']:>3}{row['n']:>7}"
                  f"{row['mae']:>10.1f}{row['mape']:>9.1f}{row['bias']:>+10.1f}")
        print()


def headline(rows, horizon=7):
    at_h = {r["method"]: r for r in rows if r["horizon"] == horizon}
    if "theil_sen" not in at_h or "flat" not in at_h:
        return
    ts, flat = at_h["theil_sen"], at_h["flat"]
    gain = (flat["mae"] - ts["mae"]) / flat["mae"] * 100 if flat["mae"] else 0.0
    print(f"  At h={horizon}: Theil-Sen MAE {ts['mae']:.1f} vs flat {flat['mae']:.1f} "
          f"-> {gain:+.1f}% error reduction")
    if "ols" in at_h:
        o = at_h["ols"]
        d = (o["mae"] - ts["mae"]) / o["mae"] * 100 if o["mae"] else 0.0
        print(f"  At h={horizon}: Theil-Sen MAE {ts['mae']:.1f} vs OLS  {o['mae']:.1f} "
              f"-> {d:+.1f}% error reduction")


def main():
    ap = argparse.ArgumentParser(description="Rolling-origin back-test of the forecaster")
    ap.add_argument("--camps", type=int, default=200)
    ap.add_argument("--days", type=int, default=21)
    ap.add_argument("--noise", type=float, default=0.06)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    profile = empirical_profile()
    rng = np.random.default_rng(args.seed)

    def make(burst):
        return [
            generate_history(
                days=args.days, noise=args.noise, profile=profile,
                burst_day=(int(rng.integers(3, args.days - 2)) if burst else None),
                seed=int(rng.integers(0, 2**31)),
            )
            for _ in range(args.camps)
        ]

    print("=" * 62)
    print("  ROLLING-ORIGIN BACK-TEST — synthetic Sri Lankan camp curves")
    print("=" * 62)
    print(f"  {args.camps} camps x {args.days} days, noise {args.noise:.0%}, "
          f"sizes bootstrapped from {profile['n_events']} real IDMC events")

    clean = summarise(backtest(make(False)))
    print_table(clean, "A. Normal intake (no mass-arrival burst)")
    headline(clean)

    bursty = summarise(backtest(make(True)))
    print_table(bursty, "B. With one mass-arrival burst per camp")
    headline(bursty)

    print("\n  Synthetic curves: this validates the estimator, not field accuracy.")


if __name__ == "__main__":
    main()
