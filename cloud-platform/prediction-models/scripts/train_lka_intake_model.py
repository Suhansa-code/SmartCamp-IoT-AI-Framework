"""
train_lka_intake_model.py

Trains a per-child daily food intake model on the Sri Lankan dietary recall
survey, and exports it as a language-neutral artifact both the Python pipeline
and the Node backend can read.

Target      grams of food consumed per subject per day (FOOD_AMOUNT_CONS summed
            per SUBJECT; one 24-hour recall day per subject, verified)
Features    age, sex, province -- the only survey variables also available at
            camp registration time. WEIGHT and HEIGHT are in the survey and are
            physiologically the better predictors, but the registration form does
            not capture them, so a model using them could not be deployed.
Estimator   Ridge with cross-validated alpha, on standardised features.

Read the metrics before trusting this
-------------------------------------
Predicting one person's single-day intake is dominated by individual variation:
the target SD is 0.804 kg on a mean of 1.914. Cross-validated R2 is ~0.07. The
model is not accurate per person and does not claim to be.

Its value is at camp scale, where individual noise averages out, and it comes
from one specific property: the model predicts CONDITIONAL MEANS. The rate table
it supplements uses the survey MEDIAN (1.758 kg), and because the intake
distribution is right-skewed, summing a median across a camp under-provisions by
roughly 8 % regardless of camp size -- that error is bias, so it does not shrink
as the camp grows. Predicting means removes it.

Measured on bootstrap camps (mean absolute error on the camp total):

    camp size    median constant    this model
    50                     8.24 %        4.74 %
    95                     7.91 %        3.31 %
    500                    8.11 %        1.52 %

Note honestly that a plain MEAN constant (1.914 kg) scores 3.41 % at 95 people.
Nearly all of the improvement above is the median-to-mean correction, not the
regression. The model's own contribution over a mean constant is about 0.1
percentage points. It is shipped because it also adapts by age, sex and
province, and because it makes the aggregation statistic correct by
construction -- not because the regression is strong.

Scope limit
-----------
The survey covers ages 6-14. Predictions outside that range are extrapolation,
so the model clamps age into [6, 14] and records that it did.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import RidgeCV
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE.parent / "resource-model"
OUT_DIR = HERE.parent / "models" / "lka_v2"

AGE_MIN, AGE_MAX = 6, 14
ALPHAS = np.logspace(-3, 3, 25)
FOLDS = 5
BOOTSTRAP_CAMPS = 2000


def load_training_frame() -> pd.DataFrame:
    subjects = pd.read_csv(RAW_DIR / "subject_user.csv", low_memory=False)
    cons = pd.read_csv(RAW_DIR / "consumption_user.csv", low_memory=False)

    countries = sorted(subjects["ADM0_NAME"].dropna().unique())
    if countries != ["Sri Lanka"]:
        raise ValueError(f"Expected a Sri Lanka-only survey, found {countries}")

    # One recall day per subject, so a per-SUBJECT sum is a daily total.
    per_subject_days = cons.groupby("SUBJECT")[["ROUND", "SURVEY_DAY"]].apply(
        lambda g: g.drop_duplicates().shape[0]
    )
    if (per_subject_days > 1).any():
        raise ValueError("Some subjects have more than one recall day; "
                         "the per-subject sum would be a multi-day total.")

    daily = cons.groupby("SUBJECT", as_index=False)["FOOD_AMOUNT_CONS"].sum()
    frame = daily.merge(
        subjects[["SUBJECT", "AGE_YEAR", "SEX", "ADM1_NAME"]], on="SUBJECT"
    ).dropna(subset=["AGE_YEAR", "SEX", "ADM1_NAME"])
    frame["food_kg_day"] = frame["FOOD_AMOUNT_CONS"] / 1000.0
    return frame


def build_design(frame: pd.DataFrame, provinces: list[str]) -> np.ndarray:
    """age, female flag, then one province flag per province after the first."""
    cols = [frame["AGE_YEAR"].to_numpy(dtype=float),
            (frame["SEX"].to_numpy() == 2).astype(float)]
    for province in provinces[1:]:
        cols.append((frame["ADM1_NAME"].to_numpy() == province).astype(float))
    return np.column_stack(cols)


def camp_level_mape(actual, predicted, sizes, rng) -> dict:
    """Mean absolute % error on the camp TOTAL, over bootstrap camps."""
    out = {}
    for size in sizes:
        errors = []
        for _ in range(BOOTSTRAP_CAMPS):
            idx = rng.choice(len(actual), size, replace=True)
            true_total = actual[idx].sum()
            errors.append(abs(predicted[idx].sum() - true_total) / true_total * 100)
        out[str(size)] = round(float(np.mean(errors)), 3)
    return out


def main():
    frame = load_training_frame()
    provinces = sorted(frame["ADM1_NAME"].unique())
    feature_names = (["age_years", "is_female"]
                     + [f"province_{p}" for p in provinces[1:]])

    X = build_design(frame, provinces)
    y = frame["food_kg_day"].to_numpy(dtype=float)

    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)

    kf = KFold(FOLDS, shuffle=True, random_state=42)
    model = RidgeCV(alphas=ALPHAS).fit(Xs, y)
    oof = cross_val_predict(RidgeCV(alphas=ALPHAS), Xs, y, cv=kf)

    rng = np.random.default_rng(42)
    sizes = [25, 50, 95, 200, 500]
    median_const = np.full(len(y), float(np.median(y)))
    mean_const = np.full(len(y), float(y.mean()))

    metrics = {
        "per_person": {
            "n": int(len(y)),
            "target_mean_kg": round(float(y.mean()), 4),
            "target_median_kg": round(float(np.median(y)), 4),
            "target_sd_kg": round(float(y.std(ddof=1)), 4),
            "cv_folds": FOLDS,
            "cv_mae_kg": round(float(mean_absolute_error(y, oof)), 4),
            "cv_r2": round(float(r2_score(y, oof)), 4),
            "baseline_median_mae_kg": round(float(mean_absolute_error(y, median_const)), 4),
            "baseline_median_r2": round(float(r2_score(y, median_const)), 4),
            "baseline_mean_mae_kg": round(float(mean_absolute_error(y, mean_const)), 4),
        },
        "camp_total_mape_pct": {
            "model": camp_level_mape(y, oof, sizes, np.random.default_rng(42)),
            "baseline_median_constant": camp_level_mape(y, median_const, sizes, np.random.default_rng(42)),
            "baseline_mean_constant": camp_level_mape(y, mean_const, sizes, np.random.default_rng(42)),
        },
        "interpretation": (
            "Per-person R2 is low because single-day intake is dominated by "
            "individual variation. At camp scale the model beats the median "
            "constant substantially, but most of that gain is the median-to-mean "
            "correction rather than the regression; against a mean constant the "
            "model's advantage is roughly 0.1 percentage points."
        ),
    }

    artifact = {
        "schema_version": 1,
        "model_id": "lka_child_intake_ridge",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_by": "scripts/train_lka_intake_model.py",
        "target": "food_kg_day — grams consumed per subject per 24h recall day / 1000",
        "estimator": "RidgeCV on standardised features",
        "alpha": round(float(model.alpha_), 6),
        "training_data": {
            "source": "subject_user.csv + consumption_user.csv",
            "country": "Sri Lanka (asserted at load)",
            "n_subjects": int(len(frame)),
            "age_min": int(frame["AGE_YEAR"].min()),
            "age_max": int(frame["AGE_YEAR"].max()),
            "provinces": provinces,
            "recall_days_per_subject": 1,
        },
        "features": feature_names,
        "provinces": provinces,
        "reference_province": provinces[0],
        # When the camp's province is unknown, setting each province flag to its
        # sample mean yields the national marginal prediction rather than
        # silently assuming the reference province, which happens to be the
        # highest-intake one.
        "province_dummy_means": {
            f"province_{p}": round(float((frame["ADM1_NAME"] == p).mean()), 6)
            for p in provinces[1:]
        },
        "scaler": {
            "mean": [round(float(v), 8) for v in scaler.mean_],
            "scale": [round(float(v), 8) for v in scaler.scale_],
        },
        "coefficients": [round(float(v), 8) for v in model.coef_],
        "intercept": round(float(model.intercept_), 8),
        "age_clamp": [AGE_MIN, AGE_MAX],
        "applies_to": "children only (cohort age <= 17); adults and elderly keep "
                      "their rate-table values, which have no Sri Lankan "
                      "measurement behind them",
        "metrics": metrics,
        "caveat": (
            "Trained on ages 6-14. Ages 0-5 and 15-17 are clamped into that range, "
            "which is extrapolation. WEIGHT and HEIGHT predict intake better but "
            "are not captured at registration, so they are excluded deliberately."
        ),
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "child_intake_model.json"
    path.write_text(json.dumps(artifact, indent=2))

    print(f"Wrote {path}")
    print(f"\n  estimator      RidgeCV(alpha={model.alpha_:.4g}) on {len(feature_names)} features")
    print(f"  training data  n={len(frame)} Sri Lankan children, ages "
          f"{frame['AGE_YEAR'].min()}-{frame['AGE_YEAR'].max()}, {len(provinces)} provinces")
    pp = metrics["per_person"]
    print(f"\n  PER PERSON     CV MAE {pp['cv_mae_kg']:.3f} kg   CV R2 {pp['cv_r2']:+.3f}")
    print(f"                 median constant MAE {pp['baseline_median_mae_kg']:.3f} "
          f"(R2 {pp['baseline_median_r2']:+.3f})")
    print(f"\n  CAMP TOTAL     {'size':>6}{'model':>10}{'median':>10}{'mean':>10}")
    ct = metrics["camp_total_mape_pct"]
    for size in ["25", "50", "95", "200", "500"]:
        print(f"                 {size:>6}{ct['model'][size]:>9.2f}%"
              f"{ct['baseline_median_constant'][size]:>9.2f}%"
              f"{ct['baseline_mean_constant'][size]:>9.2f}%")
    print("\n  Coefficients (per standardised unit):")
    for name, coef in zip(feature_names, model.coef_):
        print(f"    {name:<26}{coef:+.4f}")


if __name__ == "__main__":
    main()
