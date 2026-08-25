"""
simulate_camp_demand.py

Builds a camp-day demand dataset for Sri Lankan disaster camps.

The honesty problem this design avoids
--------------------------------------
The obvious way to make a synthetic training set is to pick a rule, apply it to
random camp compositions, and call the output a label. A model trained on that
recovers the rule and reports a near-perfect score. That is exactly the defect
in the original Kaggle-trained model -- targets computed as population x
constant, R2 = 0.999986 -- and it teaches nothing.

So no per-person quantity is invented here. Every child's intake is drawn by
BOOTSTRAP RESAMPLING the 653 real measurements in the Sri Lankan dietary recall
survey. The camp total is the sum of real observed values, which means it
carries the real empirical variance, skew and tail. The label is therefore not
a deterministic function of the features: two camps with identical composition
get different totals, exactly as two real camps would.

What is composed from real sources
    per-child intake   bootstrap from 653 measured subject-days (survey)
    camp size          bootstrap from 78 real IDMC Sri Lankan event figures
    age structure      Census of Population and Housing 2012 (DCS)
    hazard mix         IDMC event type distribution

What is assumed, and stated
    adult and elderly intake distributions. The survey covers ages 6-14 only,
    so no measured adult distribution exists. Their means come from the rate
    table, and their spread is assumed to share the children's measured
    coefficient of variation (CV = 0.420). This is the one invented element and
    it is recorded in the dataset metadata.

What this dataset supports
    Learning how much demand VARIES -- prediction intervals and buffer stock --
    which is a genuine, non-trivial target: the required buffer is non-linear in
    camp size (about 11 % at 25 people, 2.4 % at 500) because the standard
    deviation of a sum grows as sqrt(n).

What it does not support
    Any claim about the accuracy of the mean. The mean is put in by
    construction, so a model recovering it has learned nothing.

Usage:
    python scripts/simulate_camp_demand.py --camps 4000 --out data/simulated/
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE.parent / "resource-model"
RATES = HERE.parent / "models" / "lka_v2" / "ration_rates.json"

# Census of Population and Housing 2012 (DCS), widened to the model's bands.
CHILD_SHARE = 0.28
ELDERLY_SHARE = 0.12
# Dirichlet concentration: how much camp-to-camp demographic variation to allow.
# Higher is tighter around the national shares.
DEMOGRAPHY_CONCENTRATION = 60.0


def load_measured_child_intake() -> np.ndarray:
    """The 653 real per-child daily intakes, in kg. Nothing here is generated."""
    subjects = pd.read_csv(RAW_DIR / "subject_user.csv", low_memory=False)
    cons = pd.read_csv(RAW_DIR / "consumption_user.csv", low_memory=False)

    countries = sorted(subjects["ADM0_NAME"].dropna().unique())
    if countries != ["Sri Lanka"]:
        raise ValueError(f"Expected a Sri Lanka-only survey, found {countries}")

    daily = cons.groupby("SUBJECT", as_index=False)["FOOD_AMOUNT_CONS"].sum()
    return (daily["FOOD_AMOUNT_CONS"] / 1000.0).to_numpy(dtype=float)


def load_camp_sizes() -> np.ndarray:
    """Real Sri Lankan displacement event magnitudes."""
    events = pd.read_csv(RAW_DIR / "lka_idmc_idu_events.csv")
    if sorted(events["country"].dropna().unique()) != ["Sri Lanka"]:
        raise ValueError("Expected a Sri Lanka-only event file")
    return events["figure"].dropna().to_numpy(dtype=int)


def simulate(camps: int, sizes: np.ndarray, child_intake: np.ndarray,
             rates: dict, rng, size_cap: int = 2000) -> pd.DataFrame:
    """
    One row per camp-day. Features are what an operator knows in the morning;
    the label is what the camp actually consumed that day.
    """
    child_cv = float(child_intake.std(ddof=1) / child_intake.mean())

    adult_mean = float(rates["food_adult"]["value"])
    elderly_mean = float(rates["food_elderly"]["value"])
    pregnant_topup = float(rates["food_pregnant_topup"]["value"])

    # Camps above the cap are district-wide displacement figures rather than
    # single sites; simulating a 100,000-person camp would not reflect a shelter.
    usable = sizes[(sizes >= 5) & (sizes <= size_cap)]

    rows = []
    for _ in range(camps):
        n = int(rng.choice(usable))

        shares = rng.dirichlet(
            np.array([CHILD_SHARE, 1 - CHILD_SHARE - ELDERLY_SHARE, ELDERLY_SHARE])
            * DEMOGRAPHY_CONCENTRATION
        )
        n_child = int(round(n * shares[0]))
        n_elder = int(round(n * shares[2]))
        n_child = min(n_child, n)
        n_elder = min(n_elder, n - n_child)
        n_adult = n - n_child - n_elder

        # Pregnancy: 4.4 % of women 15-49; women 15-49 are ~26 % of a population.
        n_pregnant = int(rng.binomial(max(0, n_adult), 0.044 * 0.5))

        # Children: resample REAL measured intakes.
        child_total = float(child_intake[rng.integers(0, len(child_intake), n_child)].sum()) \
            if n_child else 0.0

        # Adults and elderly: measured mean is unavailable, so a gamma with the
        # children's measured CV. This is the assumed part of the label.
        def cohort_total(count, mean):
            if count <= 0:
                return 0.0
            shape = 1.0 / child_cv ** 2
            return float(rng.gamma(shape, mean / shape, count).sum())

        adult_total = cohort_total(n_adult, adult_mean)
        elder_total = cohort_total(n_elder, elderly_mean)
        preg_total = n_pregnant * pregnant_topup

        rows.append({
            "population": n,
            "children": n_child,
            "adults": n_adult,
            "elderly": n_elder,
            "pregnant": n_pregnant,
            "children_ratio": round(n_child / n, 4),
            "elderly_ratio": round(n_elder / n, 4),
            "food_kg_actual": round(child_total + adult_total + elder_total + preg_total, 3),
        })

    frame = pd.DataFrame(rows)
    frame["food_kg_per_person"] = (frame.food_kg_actual / frame.population).round(4)
    return frame


def main():
    ap = argparse.ArgumentParser(description="Simulate Sri Lankan camp-day food demand")
    ap.add_argument("--camps", type=int, default=4000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--size-cap", type=int, default=2000)
    ap.add_argument("--out", default=str(HERE.parent / "data" / "simulated"))
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    child_intake = load_measured_child_intake()
    sizes = load_camp_sizes()
    rates = json.loads(RATES.read_text())

    frame = simulate(args.camps, sizes, child_intake, rates, rng, args.size_cap)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = out_dir / "camp_day_demand.csv"
    frame.to_csv(csv_path, index=False)

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_by": "scripts/simulate_camp_demand.py",
        "synthetic": True,
        "n_rows": len(frame),
        "grounded_in_real_data": {
            "per_child_intake": f"bootstrap resampled from {len(child_intake)} measured "
                                "subject-days, Sri Lanka dietary recall survey",
            "camp_size": f"bootstrap resampled from {len(sizes)} real IDMC Sri Lankan "
                         f"event figures, capped at {args.size_cap}",
            "age_structure": "Census of Population and Housing 2012 (DCS), 28 % under 18, "
                             "12 % aged 60+, with Dirichlet camp-to-camp variation",
            "pregnancy": "4.4 % of women 15-49, from the crude birth rate",
        },
        "assumed": {
            "adult_and_elderly_intake": (
                "The survey covers ages 6-14 only. Adult and elderly means come from "
                "the rate table; their spread is a gamma with the children's MEASURED "
                f"coefficient of variation ({child_intake.std(ddof=1)/child_intake.mean():.3f}). "
                "This is the one invented element of the label."
            ),
        },
        "valid_uses": [
            "Learning demand VARIANCE: prediction intervals, buffer stock sizing",
            "Testing the pipeline end to end at realistic scale",
        ],
        "invalid_uses": [
            "Any claim about accuracy of the mean — the mean is put in by construction",
            "Any claim about real Sri Lankan camp consumption",
        ],
    }
    (out_dir / "camp_day_demand.meta.json").write_text(json.dumps(meta, indent=2))

    print(f"Wrote {csv_path}  ({len(frame):,} camp-days)")
    print(f"Wrote {out_dir / 'camp_day_demand.meta.json'}")
    print(f"\n  population    median {frame.population.median():>8.0f}   "
          f"p90 {frame.population.quantile(.9):>8.0f}   max {frame.population.max():>8.0f}")
    print(f"  food_kg       median {frame.food_kg_actual.median():>8.1f}   "
          f"p90 {frame.food_kg_actual.quantile(.9):>8.1f}   max {frame.food_kg_actual.max():>8.1f}")
    print(f"  kg per person mean   {frame.food_kg_per_person.mean():>8.3f}   "
          f"sd {frame.food_kg_per_person.std():>8.3f}")
    print("\n  variability by camp size (this is the learnable signal):")
    print(f"    {'size band':<16}{'n camps':>9}{'mean kg/person':>16}{'sd kg/person':>14}")
    for lo, hi in [(5, 25), (25, 60), (60, 150), (150, 400), (400, 2000)]:
        band = frame[(frame.population >= lo) & (frame.population < hi)]
        if len(band) > 20:
            print(f"    {f'{lo}-{hi}':<16}{len(band):>9}{band.food_kg_per_person.mean():>16.3f}"
                  f"{band.food_kg_per_person.std():>14.3f}")


if __name__ == "__main__":
    main()
