"""
train_person_intake_curve.py

Fits a PER-PERSON daily food intake curve — for every age, adults and elderly
included — from Sri Lankan household survey totals.

The problem this solves
-----------------------
The FAO/WHO GIFT survey gives per-person intake, but only for ages 6-14. That is
why the adult rate in the rate table came from a configuration file and the
elderly rate was an assumption.

The BRIGHT household survey covers all ages, but records food at the HOUSEHOLD
level: it knows a household consumed 3.5 kg and who lives there, never who ate
what. So a per-person model cannot be trained directly on it.

The method
----------
A household's food is the sum of its members' consumption. If each person's
intake is a smooth function f of age and sex, then

    household_kg  =  sum over members i of  f(age_i, sex_i)

Write f as a linear combination of spline basis functions, f = sum_k beta_k *
B_k(age, sex). Then the household total is

    household_kg  =  sum_k beta_k * ( sum over members i of B_k(age_i, sex_i) )

which is an ordinary linear regression whose features are household-level sums
of the basis functions. Fitting it recovers beta, and therefore f — a per-person
curve, estimated from data that never attributes food to a person.

This is the standard identification strategy behind adult-equivalence scales.
It works because households vary in composition: comparing a household of two
adults with one of two adults and a child identifies the child's increment.

Honest limits
-------------
  * Indirect. No individual was ever observed eating. The curve is the best
    additive decomposition of household totals, not a measurement of a person.
  * Intra-household allocation is invisible. If Sri Lankan households
    systematically serve men more, the curve attributes that to sex; if they
    serve children last in scarcity, the child estimate absorbs it.
  * Raw at-home basis. These are food quantities as acquired, not cooked weight
    and not an issued ration. Levels are not comparable with the rate table;
    ratios are.
  * Low R2 (about 0.07) because weekly household purchasing is lumpy. The curve
    is nonetheless well determined — bootstrap intervals are reported.

Usage:
    python scripts/train_person_intake_curve.py \
        --source "~/Downloads/data-sets/dataverse_files (1)/Data"
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import RidgeCV
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.preprocessing import SplineTransformer

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / "models" / "lka_v2"
DEFAULT_SOURCE = "~/Downloads/data-sets/dataverse_files (1)/Data"

N_KNOTS, DEGREE = 7, 3
AGE_CAP = 95
ALPHAS = np.logspace(-3, 3, 25)
BOOTSTRAP = 500


def load(source: Path):
    food = pd.read_csv(source / "mod_j1_fah_long.tab", sep="\t", low_memory=False)
    roster = pd.read_csv(source / "mod_b0_roster_long.tab", sep="\t", low_memory=False)

    consumed = food[(food.j1_01 == 1) & food.j1_02.notna() & food.fcf_kg.notna()].copy()
    consumed["kg"] = consumed.j1_02 * consumed.fcf_kg
    hh = consumed.groupby("hhcode", as_index=False).kg.sum()
    hh["kg_day"] = hh.kg / 7.0

    people = roster[roster.b0_04_years.notna() & roster.b0_02.notna()].copy()
    people["age"] = people.b0_04_years.clip(0, AGE_CAP)
    # Codebook mod_b0_roster_long: b0_02 is 0 = Male, 1 = Female.
    people["female"] = (people.b0_02 == 1).astype(float)
    return hh, people


def design(people: pd.DataFrame, spline: SplineTransformer):
    """Per-person basis, summed to household level."""
    base = spline.transform(people[["age"]].to_numpy())
    interacted = base * people.female.to_numpy()[:, None]
    stacked = np.hstack([base, interacted])
    frame = pd.DataFrame(stacked, columns=[f"b{i}" for i in range(stacked.shape[1])])
    frame["hhcode"] = people.hhcode.to_numpy()
    return frame.groupby("hhcode", as_index=False).sum(), base.shape[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[2])
    ap.add_argument("--source", default=DEFAULT_SOURCE)
    args = ap.parse_args()

    source = Path(args.source).expanduser()
    if not (source / "mod_j1_fah_long.tab").exists():
        raise SystemExit(f"BRIGHT survey not found at {source}")

    hh, people = load(source)
    spline = SplineTransformer(n_knots=N_KNOTS, degree=DEGREE,
                               include_bias=True).fit(people[["age"]].to_numpy())
    agg, n_base = design(people, spline)

    sizes = people.groupby("hhcode").size().rename("n")
    frame = hh.merge(agg, on="hhcode").merge(sizes, on="hhcode")
    frame = frame[(frame.n > 0) & (frame.n <= 15) & (frame.kg_day > 0.1) & (frame.kg_day < 40)]

    cols = [c for c in frame.columns if c.startswith("b")]
    X = frame[cols].to_numpy(dtype=float)
    y = frame.kg_day.to_numpy(dtype=float)

    print("=" * 72)
    print("  PER-PERSON INTAKE CURVE from household totals — BRIGHT Sri Lanka")
    print("=" * 72)
    print(f"  {len(frame):,} households · {int(frame.n.sum()):,} people · "
          f"{n_base} age basis functions x 2 for sex")

    kf = KFold(5, shuffle=True, random_state=42)
    oof = cross_val_predict(RidgeCV(alphas=ALPHAS, fit_intercept=False), X, y, cv=kf)
    print(f"\n  5-fold CV on household kg/day:  MAE {mean_absolute_error(y, oof):.3f}   "
          f"R2 {r2_score(y, oof):.3f}")
    print("  (six-band step model, for comparison: MAE 1.415  R2 0.064)")

    model = RidgeCV(alphas=ALPHAS, fit_intercept=False).fit(X, y)

    # bootstrap the curve, not just the coefficients
    rng = np.random.default_rng(42)
    grid = np.arange(0, AGE_CAP + 1, 1).reshape(-1, 1)
    Bg = spline.transform(grid)
    curves_m = np.empty((BOOTSTRAP, len(grid)))
    curves_f = np.empty((BOOTSTRAP, len(grid)))
    for i in range(BOOTSTRAP):
        idx = rng.integers(0, len(y), len(y))
        b = RidgeCV(alphas=ALPHAS, fit_intercept=False).fit(X[idx], y[idx]).coef_
        curves_m[i] = Bg @ b[:n_base]
        curves_f[i] = curves_m[i] + Bg @ b[n_base:]

    male = Bg @ model.coef_[:n_base]
    female = male + Bg @ model.coef_[n_base:]

    print(f"\n  FITTED CURVE — raw at-home kg/person/day, with bootstrap 95 % bands")
    print(f"    {'age':>5}{'male':>9}{'95% CI':>18}{'female':>9}{'95% CI':>18}")
    for a in range(0, AGE_CAP + 1, 5):
        lo_m, hi_m = np.percentile(curves_m[:, a], [2.5, 97.5])
        lo_f, hi_f = np.percentile(curves_f[:, a], [2.5, 97.5])
        print(f"    {a:>5}{male[a]:>9.3f}{f'[{lo_m:.3f}, {hi_m:.3f}]':>18}"
              f"{female[a]:>9.3f}{f'[{lo_f:.3f}, {hi_f:.3f}]':>18}")

    adult_ref = float((male[18:60].mean() + female[18:60].mean()) / 2)
    print(f"\n  RATIOS TO THE MEAN ADULT (18-59 = {adult_ref:.3f} kg/day)")
    for label, lo, hi in [("children 0-17", 0, 17), ("adults 18-59", 18, 59),
                          ("elderly 60-74", 60, 74), ("elderly 75+", 75, AGE_CAP)]:
        band = float((male[lo:hi + 1].mean() + female[lo:hi + 1].mean()) / 2)
        print(f"    {label:<16}{band:>8.3f} kg/day{band / adult_ref:>10.3f}x")
    print(f"\n    peak intake at age {int(np.argmax((male + female) / 2))}")

    artifact = {
        "schema_version": 1,
        "model_id": "lka_person_intake_curve",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_by": "scripts/train_person_intake_curve.py",
        "estimator": f"RidgeCV on a degree-{DEGREE} spline basis "
                     f"({N_KNOTS} knots) in age, interacted with sex, "
                     "summed to household level and fitted without intercept",
        "identification": (
            "Per-person intake is recovered from household totals: a household's "
            "food is the sum of its members', so a basis expansion in age and sex "
            "summed over members turns the per-person curve into an ordinary "
            "regression. No individual intake was observed."
        ),
        "training_data": {
            "source": "BRIGHT Sri Lanka household survey, February 2025",
            "n_households": int(len(frame)),
            "n_people": int(frame.n.sum()),
        },
        "measurement_basis": "raw at-home food quantity; NOT cooked weight, NOT an issued ration",
        "alpha": round(float(model.alpha_), 6),
        "metrics": {
            "cv_mae_kg_household_day": round(float(mean_absolute_error(y, oof)), 4),
            "cv_r2": round(float(r2_score(y, oof)), 4),
            "comparison_six_band_mae": 1.415,
        },
        "curve": {
            "ages": list(range(0, AGE_CAP + 1)),
            "male_kg_day": [round(float(v), 4) for v in male],
            "female_kg_day": [round(float(v), 4) for v in female],
            "male_ci_low": [round(float(v), 4) for v in np.percentile(curves_m, 2.5, axis=0)],
            "male_ci_high": [round(float(v), 4) for v in np.percentile(curves_m, 97.5, axis=0)],
            "female_ci_low": [round(float(v), 4) for v in np.percentile(curves_f, 2.5, axis=0)],
            "female_ci_high": [round(float(v), 4) for v in np.percentile(curves_f, 97.5, axis=0)],
        },
        "adult_reference_kg_day": round(adult_ref, 4),
        "caveats": [
            "Indirect estimate: no individual was observed eating.",
            "Intra-household allocation is invisible and is absorbed into the curve.",
            "Raw at-home basis; ratios transfer to the rate table, levels do not.",
        ],
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "person_intake_curve.json"
    path.write_text(json.dumps(artifact, indent=2))
    print(f"\nWrote {path}")
    print("=" * 72)


if __name__ == "__main__":
    main()
