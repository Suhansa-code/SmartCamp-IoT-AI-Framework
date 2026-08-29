"""
train_raw_food_model.py

Trains the food consumption model on a RAW basis and writes the deployable
artifact models/lka_v2/food_rates_raw.json.

Why raw
-------
A camp store holds raw rice, dhal and oil. The kitchen serves cooked food. Rice
roughly doubles in weight when cooked, so a demand figure in cooked kilograms
cannot be subtracted from a raw stock level -- it over-states the draw-down by
about 1.75x and halves the projected days of cover.

The BRIGHT Sri Lanka household survey measures exactly the right quantity: food
acquired and consumed at home, in the form it was bought, over a 7-day recall.
So this model is fitted directly on that basis, with no conversion step.

The model
---------
Household food mass is observed; individual intake is not. Regressing household
kg/day on the household's six age-band counts WITHOUT AN INTERCEPT recovers the
per-person rate for each band as a coefficient:

    kg_day ~ b1*n_infant + b2*n_child + ... + b6*n_75plus

The zero intercept is load-bearing. Allowing one lets it absorb per-person mass
and the adult coefficient falls. Confidence intervals come from a bootstrap over
households.

Usage:  python scripts/train_raw_food_model.py
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.metrics import mean_absolute_error, r2_score

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
OUT = REPO / "models" / "lka_v2" / "food_rates_raw.json"
SOURCE = REPO / "resource-model" / "lka_household_food.csv"

BANDS = ["infant_0_5", "child_6_14", "teen_15_17", "adult_18_59", "eld_60_74", "eld_75plus"]
EDGES = [(0, 5), (6, 14), (15, 17), (18, 59), (60, 74), (75, 130)]
BOOTSTRAP = 1000
SEED = 42


def load_household_frame():
    """
    One row per household: raw kg/day consumed, plus six age-band counts.

    Produced by scripts/prepare_household_food_data.py, which is the single
    place the BRIGHT modules are joined and filtered -- households over 15
    people or outside 0.1-40 kg/day are dropped there as institutions or data
    errors. Reimplementing that here would silently diverge from it: without
    those bounds bulk purchases dominate the fit and the adult 95 % interval
    widens from about +/-4 % to +/-35 %.
    """
    if not SOURCE.exists():
        raise SystemExit(
            f"{SOURCE} not found.\n"
            "Run: python scripts/prepare_household_food_data.py --source "
            '"~/Downloads/data-sets/dataverse_files (1)/Data"'
        )
    return pd.read_csv(SOURCE)


def bootstrap_ci(X, y, n=BOOTSTRAP, seed=SEED):
    rng = np.random.default_rng(seed)
    draws = np.empty((n, X.shape[1]))
    for i in range(n):
        idx = rng.integers(0, len(X), len(X))
        draws[i] = LinearRegression(fit_intercept=False).fit(X[idx], y[idx]).coef_
    return np.percentile(draws, [2.5, 97.5], axis=0)


def main():
    frame = load_household_frame()
    X = frame[BANDS].values.astype(float)
    # Solid food only. Beverages live in the same survey module, and the model's
    # output is combined with commodity shares that also exclude them -- mixing
    # the two bases put white rice 20 % below its directly measured value.
    # Drinking water is accounted for separately by the ration table.
    y = frame.kg_day_solid.values.astype(float)
    w = frame.hhweight.fillna(1.0).values

    model = LinearRegression(fit_intercept=False).fit(X, y)
    weighted = LinearRegression(fit_intercept=False).fit(X, y, sample_weight=w)
    lo, hi = bootstrap_ci(X, y)

    # What happens if the intercept is allowed -- recorded so the choice is auditable.
    with_int = LinearRegression(fit_intercept=True).fit(X, y)

    kf = KFold(5, shuffle=True, random_state=0)
    oof = cross_val_predict(LinearRegression(fit_intercept=False), X, y, cv=kf)

    adult = float(model.coef_[BANDS.index("adult_18_59")])
    rates = {}
    print(f"  {'band':<14}{'people':>9}{'kg/day':>9}{'95% CI':>22}{'weighted':>10}{'x adult':>9}")
    for i, band in enumerate(BANDS):
        rates[band] = {
            "kg_per_day": round(float(model.coef_[i]), 4),
            "ci95": [round(float(lo[i]), 4), round(float(hi[i]), 4)],
            "weighted_kg_per_day": round(float(weighted.coef_[i]), 4),
            "ratio_to_adult": round(float(model.coef_[i] / adult), 4),
            "n_people": int(frame[band].sum()),
            "age_range": list(EDGES[i]),
        }
        print(f"  {band:<14}{int(frame[band].sum()):>9,}{model.coef_[i]:>9.4f}"
              f"{f'[{lo[i]:.4f}, {hi[i]:.4f}]':>22}{weighted.coef_[i]:>10.4f}"
              f"{model.coef_[i]/adult:>9.4f}")

    artifact = {
        "schema_version": 1,
        "artifact_id": "lka_food_rates_raw",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_by": "scripts/train_raw_food_model.py",
        "basis": "RAW as-acquired SOLID food, kg per person per day (beverages excluded)",
        "basis_note": "This is the basis a camp STORE holds and procures against. "
                      "It is NOT cooked served weight -- see ration_rates.json for "
                      "the cooked quantities the kitchen issues.",
        "estimator": "LinearRegression(fit_intercept=False) on six age-band counts",
        "evidence": "measured",
        "training_data": {
            "source": "BRIGHT Sri Lanka household survey, February 2025",
            "n_households": int(len(frame)),
            "n_people": int(frame[BANDS].sum().sum()),
            "provinces": int(frame.province.nunique()),
            "districts": int(frame.district.nunique()),
            "recall_days": 7,
            "prepared_by": "scripts/prepare_household_food_data.py",
            "filters": "household_size <= 15; 0.1 < kg_day < 40; consumed rows with a unit conversion only",
            "beverages": "excluded -- drinking water is a separate allowance in ration_rates.json",
        },
        "rates": rates,
        "metrics": {
            "cv_folds": 5,
            "cv_mae_kg_household_day": round(float(mean_absolute_error(y, oof)), 4),
            "cv_r2": round(float(r2_score(y, oof)), 4),
            "note": "Low R2 reflects lumpy household purchasing, not imprecise "
                    "coefficients: the adult rate's 95 % interval is about +/- 4 %. "
                    "Individual households buy in bulk; the per-band means are what "
                    "the model estimates and they are estimated tightly.",
            "adult_coef_if_intercept_allowed": round(
                float(with_int.coef_[BANDS.index("adult_18_59")]), 4),
            "intercept_if_allowed": round(float(with_int.intercept_), 4),
        },
        "caveats": [
            "BRIGHT measures acquisition, so waste, guests and food given away are "
            "included. For procurement that is closer to correct than pure intake.",
            "About 27 % of consumed rows have no unit conversion factor and are "
            "dropped upstream, so household totals are slightly understated.",
            "Household eating is not camp eating: a central kitchen wastes less than "
            "6,802 separate homes.",
        ],
    }
    OUT.write_text(json.dumps(artifact, indent=2))
    print(f"\n  households {len(frame):,}   people {int(frame[BANDS].sum().sum()):,}")
    print(f"  cv R2 {artifact['metrics']['cv_r2']}   "
          f"cv MAE {artifact['metrics']['cv_mae_kg_household_day']} kg/household/day")
    print(f"  intercept check: allowing one drops the adult rate to "
          f"{artifact['metrics']['adult_coef_if_intercept_allowed']}")
    print(f"\n  wrote {OUT}")


if __name__ == "__main__":
    main()
