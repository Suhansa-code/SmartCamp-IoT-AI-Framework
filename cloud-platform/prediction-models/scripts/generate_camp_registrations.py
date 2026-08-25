"""
generate_camp_registrations.py

Synthetic camp registration histories for testing the seven-day forecaster.

Why this exists
---------------
The forecaster fits a trend on daily camp registration counts. No such series
exists for Sri Lanka: camp.db holds 3 check-ins over 3 days, and the IDMC event
file records one figure per district per reporting date, not a camp population
over time. (Cyclone Ditwah looks like a 23-point trajectory but is 12 districts
reporting on the same four dates -- summing it gives 429,476 on 2025-12-31,
which is a reporting artifact, not an intake curve.)

So the curves here are generated. What is *not* generated is their scale and
onset speed: both are drawn from the 78 real Sri Lankan displacement events in
lka_idmc_idu_events.csv.

What this can and cannot support
--------------------------------
CAN: measure whether the estimator recovers a known trend, how it degrades with
     noise and mass-arrival bursts, and whether it beats a flat baseline.
CANNOT: show that real Sri Lankan camps fill along these curves. Nothing in the
     repository can show that. Any result derived from this data must be
     labelled as estimator validation, never as forecast accuracy in the field.
"""

import argparse
import csv
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE.parent / "resource-model"
IDMC = RAW_DIR / "lka_idmc_idu_events.csv"

# Onset shape per hazard type. Rapid-onset hazards fill a camp in a day or two;
# floods build over several days as water spreads; erosion displaces slowly.
# The mix and the durations come from the IDMC file (see empirical_profile()).
ONSET_SHAPE = {
    "Storm": "rapid",
    "Flood": "build",
    "Mass Movement": "rapid",
    "Erosion": "slow",
}


def empirical_profile(idmc_path: Path = IDMC) -> dict:
    """Camp-size, hazard-mix and onset-duration distributions from real events."""
    events = pd.read_csv(
        idmc_path,
        parse_dates=["displacement_date", "displacement_start_date"],
    )

    countries = sorted(events["country"].dropna().unique())
    if countries != ["Sri Lanka"]:
        raise ValueError(f"Expected a Sri Lanka-only event file, found {countries}")

    onset = (events["displacement_date"] - events["displacement_start_date"]).dt.days
    onset = onset.dropna().clip(lower=0)

    return {
        "figures": events["figure"].dropna().astype(int).tolist(),
        "hazard_weights": events["type"].value_counts(normalize=True).to_dict(),
        "onset_days": onset.astype(int).tolist(),
        "n_events": len(events),
    }


def _curve(shape: str, days: int, rng) -> np.ndarray:
    """Cumulative fraction of the final population present on each day."""
    t = np.linspace(0, 1, days)
    if shape == "rapid":
        # Most arrivals in the first day or two, then a long tail.
        frac = 1 - np.exp(-5.0 * t)
    elif shape == "build":
        # Sigmoid: slow start, steep middle, plateau.
        frac = 1 / (1 + np.exp(-9 * (t - 0.45)))
    else:  # slow
        frac = t ** 1.6
    frac = frac - frac[0]
    return frac / frac[-1] if frac[-1] > 0 else np.linspace(0, 1, days)


def generate_history(
    days: int = 14,
    peak_population: int | None = None,
    hazard: str | None = None,
    noise: float = 0.06,
    burst_day: int | None = None,
    burst_multiple: float = 4.0,
    start: date | None = None,
    seed: int | None = None,
    profile: dict | None = None,
) -> dict:
    """
    One synthetic camp's cumulative registration history.

    Args:
        days            number of daily observations
        peak_population final headcount; drawn from the real figure distribution
                        when omitted
        hazard          Storm / Flood / Mass Movement / Erosion; drawn from the
                        real hazard mix when omitted
        noise           relative day-to-day noise on the cumulative count
        burst_day       index of a mass-arrival day, for robustness testing
        burst_multiple  size of that burst relative to the normal daily intake

    Returns a dict with the history and the ground truth used to build it.
    """
    rng = np.random.default_rng(seed)
    profile = profile or empirical_profile()

    if hazard is None:
        kinds = list(profile["hazard_weights"])
        weights = np.array([profile["hazard_weights"][k] for k in kinds])
        hazard = str(rng.choice(kinds, p=weights / weights.sum()))

    if peak_population is None:
        # Bootstrap from the real figures rather than assuming a parametric
        # form: the empirical distribution is extremely skewed (median 55,
        # p90 22,783) and no tidy distribution reproduces that honestly.
        peak_population = int(rng.choice(profile["figures"]))
    peak_population = max(1, int(peak_population))

    shape = ONSET_SHAPE.get(hazard, "build")
    cumulative = _curve(shape, days, rng) * peak_population

    # Multiplicative noise, then enforce monotonicity: a cumulative
    # registration count cannot fall (departures are not modelled here).
    noisy = cumulative * (1 + rng.normal(0, noise, days))
    noisy = np.maximum.accumulate(np.maximum(noisy, 0))

    if burst_day is not None and 0 < burst_day < days:
        step = max(1.0, cumulative[burst_day] - cumulative[burst_day - 1])
        noisy[burst_day:] += step * burst_multiple

    start = start or (date.today() - timedelta(days=days - 1))
    populations = [int(round(v)) for v in noisy]

    return {
        "hazard": hazard,
        "shape": shape,
        "peak_population": peak_population,
        "days": days,
        "burst_day": burst_day,
        "history": [
            {"date": (start + timedelta(days=i)).isoformat(), "population": p}
            for i, p in enumerate(populations)
        ],
        # Ground truth: the mean daily slope of the noiseless curve, which is
        # what a trend estimator should recover.
        "true_slope_per_day": round(float((cumulative[-1] - cumulative[0]) / (days - 1)), 3),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[2])
    ap.add_argument("--camps", type=int, default=1, help="how many camps to generate")
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--population", type=int, default=None)
    ap.add_argument("--hazard", default=None, choices=sorted(ONSET_SHAPE))
    ap.add_argument("--noise", type=float, default=0.06)
    ap.add_argument("--burst-day", type=int, default=None)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=None, help="write JSON here instead of stdout")
    ap.add_argument("--csv", default=None, help="also write a flat CSV here")
    args = ap.parse_args()

    profile = empirical_profile()
    rng = np.random.default_rng(args.seed)

    camps = [
        generate_history(
            days=args.days,
            peak_population=args.population,
            hazard=args.hazard,
            noise=args.noise,
            burst_day=args.burst_day,
            seed=int(rng.integers(0, 2**31)),
            profile=profile,
        )
        for _ in range(args.camps)
    ]

    payload = {
        "generated_by": "scripts/generate_camp_registrations.py",
        "synthetic": True,
        "grounding": {
            "source": "lka_idmc_idu_events.csv",
            "n_real_events": profile["n_events"],
            "note": "Camp sizes bootstrapped from real event figures; hazard mix "
                    "and onset durations taken from the same file. The daily "
                    "curve shape is generated, not observed.",
        },
        "camps": camps,
    }

    if args.out:
        Path(args.out).write_text(json.dumps(payload, indent=2))
        print(f"Wrote {args.out}  ({len(camps)} camp(s))")
    if args.csv:
        with open(args.csv, "w", newline="") as fh:
            writer = csv.writer(fh)
            writer.writerow(["camp", "date", "population", "hazard"])
            for i, camp in enumerate(camps):
                for row in camp["history"]:
                    writer.writerow([i, row["date"], row["population"], camp["hazard"]])
        print(f"Wrote {args.csv}")
    if not args.out and not args.csv:
        for camp in camps:
            path = " -> ".join(str(r["population"]) for r in camp["history"])
            print(f"{camp['hazard']:<14} peak {camp['peak_population']:>7,}  "
                  f"true slope {camp['true_slope_per_day']:>9,.1f}/day")
            print(f"  {path}")


if __name__ == "__main__":
    main()
