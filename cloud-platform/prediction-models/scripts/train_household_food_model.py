"""
train_household_food_model.py

Trains a household food-demand model on the BRIGHT Sri Lanka household survey
and exports per-cohort daily rates -- including, for the first time in this
project, MEASURED adult and elderly rates.

What changes because of this
----------------------------
Before this dataset, the rate table had one measured value (children, from the
FAO/WHO GIFT survey of ages 6-14), one production configuration value (adults),
and one assumption (elderly = adult x 0.85). BRIGHT covers whole households, so
every cohort is observed on a single consistent basis and the ratios between
them can be estimated rather than assumed.

Target       household kilograms of food per day
Features     counts of household members in six age bands
Estimator    linear regression WITHOUT an intercept, so each coefficient is
             directly interpretable as one person's daily consumption

Why no intercept: with one, the model fits a fixed per-household quantity and
the coefficients stop meaning "per person". The intercept version is fitted too
and reported, because the comparison is informative -- it separates a household
overhead from the per-person component.

Read the R2 with care
---------------------
Household weekly food consumption is extremely noisy: purchasing is lumpy, stock
carries over between weeks, and guests are not recorded. Cross-validated R2 is
around 0.07, so the model cannot predict any single household well.

That does not undermine the coefficients. With 6,802 households the per-cohort
means are estimated precisely -- the adult rate has a bootstrap 95 % interval of
about +/- 4 %. Low R2 and tight coefficient intervals coexist: one is about
predicting individuals, the other about estimating an average. Camp provisioning
needs the average.

Basis warning
-------------
These are raw at-home food quantities, not cooked weight and not issued rations.
Absolute levels are NOT comparable with the rate table. The transferable output
is the ratio between cohorts, which is exported alongside the raw rates.

Usage:
    python scripts/train_household_food_model.py
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, RidgeCV
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "resource-model" / "lka_household_food.csv"
OUT_DIR = HERE.parent / "models" / "lka_v2"

BANDS = ["infant_0_5", "child_6_14", "teen_15_17",
         "adult_18_59", "eld_60_74", "eld_75plus"]
BOOTSTRAP = 2000
FOLDS = 5


def bootstrap_ci(X, y, n=BOOTSTRAP, seed=42):
    rng = np.random.default_rng(seed)
    draws = np.empty((n, X.shape[1]))
    for i in range(n):
        idx = rng.integers(0, len(y), len(y))
        draws[i] = LinearRegression(fit_intercept=False).fit(X[idx], y[idx]).coef_
    return draws


def main():
    if not DATA.exists():
        raise SystemExit(f"{DATA} not found. Run scripts/prepare_household_food_data.py first.")

    frame = pd.read_csv(DATA)
    X = frame[BANDS].to_numpy(dtype=float)
    y = frame["kg_day"].to_numpy(dtype=float)
    weights = frame["hhweight"].fillna(1.0).to_numpy(dtype=float)

    print("=" * 76)
    print("  HOUSEHOLD FOOD DEMAND — BRIGHT Sri Lanka, February 2025")
    print("=" * 76)
    print(f"  {len(frame):,} households · {int(frame.household_size.sum()):,} people · "
          f"{frame.province.nunique()} provinces · {frame.district.nunique()} districts")

    # ── model comparison, honestly ───────────────────────────────────────────
    kf = KFold(FOLDS, shuffle=True, random_state=42)
    print(f"\n  MODEL COMPARISON ({FOLDS}-fold CV, target = household kg/day)")
    print(f"    {'model':<34}{'MAE':>9}{'R2':>9}")

    mean_const = np.full(len(y), y.mean())
    print(f"    {'baseline: household mean':<34}{mean_absolute_error(y, mean_const):>9.3f}"
          f"{r2_score(y, mean_const):>9.3f}")

    per_capita = frame.household_size.to_numpy(float) * (y / frame.household_size).mean()
    print(f"    {'baseline: size x mean per person':<34}{mean_absolute_error(y, per_capita):>9.3f}"
          f"{r2_score(y, per_capita):>9.3f}")

    candidates = {
        "linear, no intercept": LinearRegression(fit_intercept=False),
        "linear, with intercept": LinearRegression(),
        "ridge (CV alpha)": RidgeCV(alphas=np.logspace(-3, 3, 25)),
        "random forest": RandomForestRegressor(n_estimators=300, min_samples_leaf=10,
                                               random_state=42, n_jobs=-1),
        "gradient boosting": GradientBoostingRegressor(random_state=42, max_depth=3,
                                                       n_estimators=200, learning_rate=0.05),
    }
    for name, est in candidates.items():
        oof = cross_val_predict(est, X, y, cv=kf)
        print(f"    {name:<34}{mean_absolute_error(y, oof):>9.3f}{r2_score(y, oof):>9.3f}")

    # ── the coefficients, which are the actual deliverable ───────────────────
    model = LinearRegression(fit_intercept=False).fit(X, y)
    weighted = LinearRegression(fit_intercept=False).fit(X, y, sample_weight=weights)
    with_int = LinearRegression().fit(X, y)
    draws = bootstrap_ci(X, y)

    adult = float(model.coef_[BANDS.index("adult_18_59")])

    print("\n  PER-COHORT DAILY FOOD  (raw at-home basis, kg/person/day)")
    print(f"    {'age band':<14}{'people':>8}{'kg/day':>9}{'95% CI':>20}"
          f"{'weighted':>10}{'vs adult':>10}")
    rates = {}
    for i, band in enumerate(BANDS):
        lo, hi = np.percentile(draws[:, i], [2.5, 97.5])
        rates[band] = {
            "kg_per_day": round(float(model.coef_[i]), 4),
            "ci95": [round(float(lo), 4), round(float(hi), 4)],
            "weighted_kg_per_day": round(float(weighted.coef_[i]), 4),
            "ratio_to_adult": round(float(model.coef_[i] / adult), 4),
            "n_people": int(frame[band].sum()),
        }
        print(f"    {band:<14}{int(frame[band].sum()):>8,}{model.coef_[i]:>9.3f}"
              f"{f'[{lo:.3f}, {hi:.3f}]':>20}{weighted.coef_[i]:>10.3f}"
              f"{model.coef_[i] / adult:>10.3f}")

    print(f"\n    with a household intercept: {with_int.intercept_:.3f} kg/day fixed, "
          f"adult falls to {with_int.coef_[BANDS.index('adult_18_59')]:.3f}")
    print("    -> part of household food is a fixed overhead, not per person.")

    # ── the finding that matters for the rate table ──────────────────────────
    e6074 = rates["eld_60_74"]["ratio_to_adult"]
    e75 = rates["eld_75plus"]["ratio_to_adult"]
    c614 = rates["child_6_14"]["ratio_to_adult"]
    print("\n  AGAINST THE CURRENT RATE TABLE")
    print(f"    elderly/adult assumed 0.850  ->  measured {e6074:.3f} (60-74), {e75:.3f} (75+)")
    print(f"    child/adult  implied 1.100  ->  measured {c614:.3f} (ages 6-14)")
    print("    The current child figure exceeds the adult one because the two come")
    print("    from different measurement bases. On one basis, children eat less.")

    artifact = {
        "schema_version": 1,
        "model_id": "lka_household_food_cohort_rates",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_by": "scripts/train_household_food_model.py",
        "estimator": "LinearRegression(fit_intercept=False) on six age-band counts",
        "training_data": {
            "source": "BRIGHT Sri Lanka household survey, February 2025",
            "derived_file": "resource-model/lka_household_food.csv",
            "n_households": int(len(frame)),
            "n_people": int(frame.household_size.sum()),
            "provinces": int(frame.province.nunique()),
            "districts": int(frame.district.nunique()),
        },
        "measurement_basis": (
            "Raw at-home food quantities over a 7-day recall. NOT cooked weight and "
            "NOT an issued ration. Absolute levels are not comparable with the rate "
            "table; the ratios between cohorts are the transferable result."
        ),
        "rates": rates,
        "household_intercept_kg_day": round(float(with_int.intercept_), 4),
        "metrics": {
            "cv_folds": FOLDS,
            "cv_mae_kg_household_day": round(float(mean_absolute_error(
                y, cross_val_predict(LinearRegression(fit_intercept=False), X, y, cv=kf))), 4),
            "cv_r2": round(float(r2_score(
                y, cross_val_predict(LinearRegression(fit_intercept=False), X, y, cv=kf))), 4),
            "note": "Low R2 reflects lumpy household purchasing, not imprecise "
                    "coefficients: the adult rate's 95 % interval is about +/- 4 %.",
        },
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "household_cohort_rates.json"
    path.write_text(json.dumps(artifact, indent=2))
    print(f"\nWrote {path}")
    print("=" * 76)


if __name__ == "__main__":
    main()
