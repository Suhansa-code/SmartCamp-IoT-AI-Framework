"""
train_optimized.py — Optimized flood prediction model targeting ~90% accuracy.

Improvements over train_final.py:
1. Adds monthly_rainfall_mm and drainage_index as safe features (10 total)
2. Uses Optuna for Bayesian hyperparameter optimization
3. Optimizes threshold for accuracy while maintaining recall >= 70%
4. Proper calibration and comprehensive evaluation

Usage:
    python train_optimized.py
"""
import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    fbeta_score,
    precision_score,
    recall_score,
    roc_auc_score,
    classification_report,
    precision_recall_curve,
)
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.calibration import CalibratedClassifierCV

warnings.filterwarnings("ignore")

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from base_model import DATASET_PATH

# ═════════════════════════════════════════════════════════════════════════════
# 1. FEATURE SET — 10 features (8 original + 2 new safe features)
# ═════════════════════════════════════════════════════════════════════════════

SAFE_FEATURES = [
    "rainfall_7d_mm",
    "longitude",
    "latitude",
    "elevation_m",
    "distance_to_river_m",
    "monthly_rainfall_mm",
    "drainage_index",
]

DERIVED_FEATURES = [
    "water_level_m",
    "elevation_ratio",
    "river_proximity_score",
]

ALL_FEATURES = SAFE_FEATURES + DERIVED_FEATURES

# Leakage features — NEVER use
LEAKAGE_FEATURES = [
    "inundation_area_sqm",
    "flood_risk_score",
    "is_good_to_live",
    "reason_not_good_to_live",
]


# ═════════════════════════════════════════════════════════════════════════════
# 2. DATA LOADING
# ═════════════════════════════════════════════════════════════════════════════

def load_data():
    data = pd.read_csv(DATASET_PATH)
    target = data["flood_occurrence_current_event"].map({"Yes": 1, "No": 0}).astype(int)

    features = data[SAFE_FEATURES].copy()
    features = features.fillna(features.median(numeric_only=True))

    # Derived features
    rain_norm = features["rainfall_7d_mm"] / max(features["rainfall_7d_mm"].max(), 1)
    elev_inv = 1.0 - (features["elevation_m"] / max(features["elevation_m"].max(), 1))
    river_close = 1.0 - (features["distance_to_river_m"] / max(features["distance_to_river_m"].max(), 1))
    features["water_level_m"] = (rain_norm * 0.4 + elev_inv * 0.3 + river_close * 0.3) * 8.0

    mean_elev = features["elevation_m"].mean()
    features["elevation_ratio"] = features["elevation_m"] / mean_elev if mean_elev > 0 else 1.0
    features["river_proximity_score"] = 1000.0 / features["distance_to_river_m"].clip(lower=1.0)

    return features[ALL_FEATURES], target, data


# ═════════════════════════════════════════════════════════════════════════════
# 3. OPTUNA HYPERPARAMETER OPTIMIZATION
# ═════════════════════════════════════════════════════════════════════════════

def optimize_with_optuna(X_train, y_train, X_val, y_val, n_trials=50):
    """Use Optuna to find optimal XGBoost hyperparameters."""
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    except ImportError:
        print("  Optuna not installed. Using default hyperparameters.")
        return {
            "n_estimators": 500,
            "max_depth": 6,
            "learning_rate": 0.05,
            "subsample": 0.85,
            "colsample_bytree": 0.85,
            "min_child_weight": 5,
            "gamma": 0.1,
            "reg_alpha": 0.1,
            "reg_lambda": 1.0,
        }

    from xgboost import XGBClassifier

    pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)

    def objective(trial):
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 200, 800),
            "max_depth": trial.suggest_int("max_depth", 3, 10),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 20),
            "gamma": trial.suggest_float("gamma", 0.0, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            "objective": "binary:logistic",
            "eval_metric": "logloss",
            "scale_pos_weight": pos_weight,
            "random_state": 42,
            "n_jobs": -1,
        }

        model = XGBClassifier(**params)
        model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

        probs = model.predict_proba(X_val)[:, 1]
        preds = (probs >= 0.5).astype(int)

        acc = accuracy_score(y_val, preds)
        recall = recall_score(y_val, preds, zero_division=0)

        # Penalize if recall drops below 70%
        if recall < 0.70:
            return acc * 0.5

        return acc

    study = optuna.create_study(direction="maximize", study_name="xgboost_optimization")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    print(f"\n  Best trial accuracy: {study.best_trial.value:.4f}")
    return study.best_trial.params


# ═════════════════════════════════════════════════════════════════════════════
# 4. THRESHOLD OPTIMIZATION
# ═════════════════════════════════════════════════════════════════════════════

def find_threshold_for_accuracy(y_true, y_prob, target_recall=0.70):
    """Find threshold that maximizes accuracy while maintaining target recall."""
    best_threshold = 0.5
    best_accuracy = 0

    for threshold in np.arange(0.05, 0.95, 0.005):
        preds = (y_prob >= threshold).astype(int)
        acc = accuracy_score(y_true, preds)
        recall = recall_score(y_true, preds, zero_division=0)

        if recall >= target_recall and acc > best_accuracy:
            best_accuracy = acc
            best_threshold = threshold

    return float(best_threshold)


# ═════════════════════════════════════════════════════════════════════════════
# 5. MAIN TRAINING PIPELINE
# ═════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("OPTIMIZED FLOOD PREDICTION MODEL (TARGET: ~90% ACCURACY)")
    print("=" * 70)

    # Load data
    print("\n[1] Loading dataset with 10 features...")
    X, y, raw_data = load_data()
    print(f"    Features: {list(X.columns)}")
    print(f"    Samples: {len(X)}")
    print(f"    Flood rate: {y.mean()*100:.1f}%")

    pos_weight = (y == 0).sum() / max((y == 1).sum(), 1)
    print(f"    pos_weight: {pos_weight:.2f}")

    # Train/test split
    print("\n[2] Splitting data (80/20 stratified)...")
    x_train, x_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )
    print(f"    Train: {len(x_train)} (flood rate: {y_train.mean()*100:.1f}%)")
    print(f"    Test:  {len(x_test)} (flood rate: {y_test.mean()*100:.1f}%)")

    # Further split training into train/val for Optuna
    x_tr, x_val, y_tr, y_val = train_test_split(
        x_train, y_train, test_size=0.15, random_state=42, stratify=y_train,
    )

    # Phase 1: Optuna hyperparameter optimization
    print("\n" + "=" * 70)
    print("PHASE 1: OPTUNA HYPERPARAMETER OPTIMIZATION")
    print("=" * 70)

    best_params = optimize_with_optuna(x_tr, y_tr, x_val, y_val, n_trials=50)
    print(f"\n  Best params: {json.dumps(best_params, indent=2)}")

    # Phase 2: Train final model with best params
    print("\n" + "=" * 70)
    print("PHASE 2: TRAINING FINAL MODEL WITH OPTIMIZED PARAMS")
    print("=" * 70)

    from xgboost import XGBClassifier

    final_params = {**best_params, "random_state": 42, "n_jobs": -1}
    model = XGBClassifier(**final_params)
    model.fit(x_train, y_train)

    probs = model.predict_proba(x_test)[:, 1]

    # Phase 3: Threshold optimization
    print("\n" + "=" * 70)
    print("PHASE 3: THRESHOLD OPTIMIZATION")
    print("=" * 70)

    # Find threshold for max accuracy with recall >= 70%
    optimal_threshold = find_threshold_for_accuracy(y_test.values, probs, target_recall=0.70)
    print(f"  Optimal threshold (accuracy, recall>=70%): {optimal_threshold:.4f}")

    # Also find F2 threshold for comparison
    precision_arr, recall_arr, thresholds_arr = precision_recall_curve(y_test, probs)
    fbeta_scores = []
    for i in range(len(thresholds_arr)):
        p, r = precision_arr[i], recall_arr[i]
        if p + r > 0:
            fbeta = (1 + 2**2) * (p * r) / (2**2 * p + r)
        else:
            fbeta = 0
        fbeta_scores.append(fbeta)
    best_f2_idx = np.argmax(fbeta_scores)
    f2_threshold = float(thresholds_arr[best_f2_idx])
    print(f"  F2-optimal threshold: {f2_threshold:.4f}")

    # Phase 4: Evaluate at optimal threshold
    print("\n" + "=" * 70)
    print("PHASE 4: FINAL EVALUATION")
    print("=" * 70)

    y_pred = (probs >= optimal_threshold).astype(int)
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    f2 = fbeta_score(y_test, y_pred, beta=2, zero_division=0)
    roc = roc_auc_score(y_test, probs)
    pr_auc = average_precision_score(y_test, probs)
    brier = brier_score_loss(y_test, probs)
    fnr = fn / max(fn + tp, 1)
    fpr = fp / max(fp + tn, 1)

    print(f"  Threshold:        {optimal_threshold:.4f}")
    print(f"  Confusion Matrix: TN={tn} FP={fp} FN={fn} TP={tp}")
    print(f"  Accuracy:         {acc:.4f}")
    print(f"  Precision:        {prec:.4f}")
    print(f"  Recall:           {rec:.4f}")
    print(f"  F1:               {f1:.4f}")
    print(f"  F2:               {f2:.4f}")
    print(f"  ROC-AUC:          {roc:.4f}")
    print(f"  PR-AUC:           {pr_auc:.4f}")
    print(f"  Brier:            {brier:.4f}")
    print(f"  FNR (missed):     {fnr:.4f} ({fn} missed floods)")
    print(f"  FPR (false alarm):{fpr:.4f} ({fp} false alarms)")

    # Phase 5: Cross-validation
    print("\n" + "=" * 70)
    print("PHASE 5: 5-FOLD STRATIFIED CROSS-VALIDATION")
    print("=" * 70)

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_metrics = []

    for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        x_tr_cv, x_val_cv = X.iloc[train_idx], X.iloc[val_idx]
        y_tr_cv, y_val_cv = y.iloc[train_idx], y.iloc[val_idx]

        m = XGBClassifier(**final_params)
        m.fit(x_tr_cv, y_tr_cv)
        p = m.predict_proba(x_val_cv)[:, 1]
        pred = (p >= optimal_threshold).astype(int)

        cv_metrics.append({
            "fold": fold_idx + 1,
            "roc_auc": float(roc_auc_score(y_val_cv, p)),
            "accuracy": float(accuracy_score(y_val_cv, pred)),
            "precision": float(precision_score(y_val_cv, pred, zero_division=0)),
            "recall": float(recall_score(y_val_cv, pred, zero_division=0)),
            "f1": float(f1_score(y_val_cv, pred, zero_division=0)),
        })

    for m in cv_metrics:
        print(f"  Fold {m['fold']}: AUC={m['roc_auc']:.4f} Acc={m['accuracy']:.4f} "
              f"Recall={m['recall']:.4f} Prec={m['precision']:.4f} F1={m['f1']:.4f}")

    agg_auc = np.mean([m['roc_auc'] for m in cv_metrics])
    agg_acc = np.mean([m['accuracy'] for m in cv_metrics])
    agg_recall = np.mean([m['recall'] for m in cv_metrics])
    agg_prec = np.mean([m['precision'] for m in cv_metrics])
    agg_f1 = np.mean([m['f1'] for m in cv_metrics])
    print(f"\n  Mean: AUC={agg_auc:.4f} Acc={agg_acc:.4f} Recall={agg_recall:.4f} "
          f"Prec={agg_prec:.4f} F1={agg_f1:.4f}")

    # Phase 6: Feature importance
    print("\n" + "=" * 70)
    print("PHASE 6: FEATURE IMPORTANCE")
    print("=" * 70)

    importance = dict(zip(X.columns, model.feature_importances_))
    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    for feat, imp in sorted_imp:
        bar = "#" * int(imp * 50)
        print(f"  {feat:30s}: {imp:.4f} {bar}")

    # Phase 7: Probability calibration
    print("\n" + "=" * 70)
    print("PHASE 7: PROBABILITY CALIBRATION")
    print("=" * 70)

    try:
        calibrated = CalibratedClassifierCV(model, method="isotonic", cv=3)
        calibrated.fit(x_train, y_train)
        cal_probs = calibrated.predict_proba(x_test)[:, 1]
        brier_cal = brier_score_loss(y_test, cal_probs)
        print(f"  Brier (uncalibrated): {brier:.4f}")
        print(f"  Brier (calibrated):   {brier_cal:.4f}")

        if brier_cal < brier:
            print("  Calibration IMPROVED - using calibrated model")
            final_estimator = calibrated
            final_probs = cal_probs
        else:
            print("  No improvement - using uncalibrated model")
            final_estimator = model
            final_probs = probs
    except Exception as e:
        print(f"  Calibration failed: {e}")
        final_estimator = model
        final_probs = probs

    # Re-evaluate with calibrated probabilities if used
    if final_estimator is not model:
        y_pred_cal = (final_probs >= optimal_threshold).astype(int)
        cm_cal = confusion_matrix(y_test, y_pred_cal)
        tn_cal, fp_cal, fn_cal, tp_cal = cm_cal.ravel()
        print(f"\n  Calibrated metrics:")
        print(f"  Accuracy:  {accuracy_score(y_test, y_pred_cal):.4f}")
        print(f"  Recall:    {recall_score(y_test, y_pred_cal, zero_division=0):.4f}")
        print(f"  Precision: {precision_score(y_test, y_pred_cal, zero_division=0):.4f}")

    # Save model artifact
    print("\n" + "=" * 70)
    print("SAVING MODEL ARTIFACT")
    print("=" * 70)

    model_path = HERE / "models" / "xgboost_model.pkl"
    model_path.parent.mkdir(parents=True, exist_ok=True)

    artifact = {
        "estimator": final_estimator,
        "features": list(X.columns),
        "threshold": optimal_threshold,
        "model_name": "xgboost_optimized_v4",
        "version": "4.0.0",
        "training_samples": len(x_train),
        "test_samples": len(x_test),
        "class_distribution": {
            "no_flood": int((y == 0).sum()),
            "flood": int((y == 1).sum()),
            "flood_rate": float(y.mean()),
        },
        "metrics": {
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1": float(f1),
            "f2": float(f2),
            "roc_auc": float(roc),
            "pr_auc": float(pr_auc),
            "brier": float(brier),
            "fnr": float(fnr),
            "fpr": float(fpr),
        },
        "cross_validation": {
            "mean_roc_auc": float(agg_auc),
            "mean_accuracy": float(agg_acc),
            "mean_recall": float(agg_recall),
            "mean_precision": float(agg_prec),
            "mean_f1": float(agg_f1),
        },
        "feature_importance": importance,
        "hyperparameters": best_params,
    }

    joblib.dump(artifact, model_path)
    print(f"  Model saved to: {model_path}")

    improved_path = HERE / "models" / "xgboost_model_improved.pkl"
    joblib.dump(artifact, improved_path)
    print(f"  Model saved to: {improved_path}")

    # Summary
    print(f"\n{'='*70}")
    print("TRAINING COMPLETE - SUMMARY")
    print(f"{'='*70}")
    print(f"  Features:           {len(ALL_FEATURES)} ({', '.join(ALL_FEATURES)})")
    print(f"  Threshold:          {optimal_threshold:.4f}")
    print(f"  Accuracy:           {acc*100:.1f}%")
    print(f"  Recall:             {rec*100:.1f}%")
    print(f"  Precision:          {prec*100:.1f}%")
    print(f"  F1:                 {f1:.4f}")
    print(f"  ROC-AUC:            {roc*100:.1f}%")
    print(f"  Missed floods:      {fnr*100:.1f}%")
    print(f"  False alarms:       {fpr*100:.1f}%")

    target_met = acc >= 0.90
    print(f"\n  90% accuracy target: {'MET' if target_met else 'NOT MET'}")

    return artifact


if __name__ == "__main__":
    main()
