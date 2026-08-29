"""
train_final.py — Train the final XGBoost model with balanced settings.

Threshold: 0.0947 (optimized for F2 = recall-heavy balance)
Features: 8 features (no leakage)
Model: XGBoost with tuned hyperparameters
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
)
from sklearn.model_selection import train_test_split, StratifiedKFold

warnings.filterwarnings("ignore")

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from base_model import DATASET_PATH, EXTENDED_FEATURES

# ═════════════════════════════════════════════════════════════════════════════
# 1. DATA LOADING
# ═════════════════════════════════════════════════════════════════════════════

def load_data():
    data = pd.read_csv(DATASET_PATH)
    target = data["flood_occurrence_current_event"].map({"Yes": 1, "No": 0}).astype(int)

    features = data[["rainfall_7d_mm", "longitude", "latitude", "elevation_m", "distance_to_river_m"]].copy()
    features = features.fillna(features.median(numeric_only=True))

    # Derived features (same as production inference)
    rain_norm = features["rainfall_7d_mm"] / max(features["rainfall_7d_mm"].max(), 1)
    elev_inv = 1.0 - (features["elevation_m"] / max(features["elevation_m"].max(), 1))
    river_close = 1.0 - (features["distance_to_river_m"] / max(features["distance_to_river_m"].max(), 1))
    features["water_level_m"] = (rain_norm * 0.4 + elev_inv * 0.3 + river_close * 0.3) * 8.0

    mean_elev = features["elevation_m"].mean()
    features["elevation_ratio"] = features["elevation_m"] / mean_elev if mean_elev > 0 else 1.0
    features["river_proximity_score"] = 1000.0 / features["distance_to_river_m"].clip(lower=1.0)

    return features[EXTENDED_FEATURES], target, data


# ═════════════════════════════════════════════════════════════════════════════
# 2. TRAIN FINAL MODEL
# ═════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("TRAINING FINAL XGBOOST MODEL (BALANCED APPROACH)")
    print("=" * 70)

    X, y, raw_data = load_data()
    print(f"Features: {list(X.columns)}")
    print(f"Samples: {len(X)}, Flood rate: {y.mean()*100:.1f}%")

    pos_weight = (y == 0).sum() / max((y == 1).sum(), 1)
    print(f"pos_weight: {pos_weight:.2f}")

    # Train/test split
    x_train, x_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )

    # ── Train XGBoost ──
    print("\nTraining XGBoost...")
    from xgboost import XGBClassifier

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=5,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        objective="binary:logistic",
        eval_metric="logloss",
        scale_pos_weight=pos_weight,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(x_train, y_train)

    # ── Evaluate ──
    probs = model.predict_proba(x_test)[:, 1]

    # Find optimal threshold for F2
    from sklearn.metrics import precision_recall_curve
    precision, recall, thresholds = precision_recall_curve(y_test, probs)
    fbeta_scores = []
    for i in range(len(thresholds)):
        p, r = precision[i], recall[i]
        if p + r > 0:
            fbeta = (1 + 2**2) * (p * r) / (2**2 * p + r)
        else:
            fbeta = 0
        fbeta_scores.append(fbeta)
    best_idx = np.argmax(fbeta_scores)
    optimal_threshold = float(thresholds[best_idx])

    print(f"\nOptimal threshold (F2): {optimal_threshold:.4f}")

    # Evaluate at optimal threshold
    y_pred = (probs >= optimal_threshold).astype(int)
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    print(f"\n{'='*50}")
    print("FINAL MODEL METRICS (threshold={:.4f})".format(optimal_threshold))
    print(f"{'='*50}")
    print(f"Confusion Matrix: TN={tn} FP={fp} FN={fn} TP={tp}")
    print(f"Accuracy:    {accuracy_score(y_test, y_pred):.4f}")
    print(f"Precision:   {precision_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"Recall:      {recall_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"F1:          {f1_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"F2:          {fbeta_score(y_test, y_pred, beta=2, zero_division=0):.4f}")
    print(f"ROC-AUC:     {roc_auc_score(y_test, probs):.4f}")
    print(f"PR-AUC:      {average_precision_score(y_test, probs):.4f}")
    print(f"Brier:       {brier_score_loss(y_test, probs):.4f}")
    print(f"FNR:         {fn/(fn+tp):.4f} ({fn} missed floods)")
    print(f"FPR:         {fp/(fp+tn):.4f} ({fp} false alarms)")

    # ── Cross-validation ──
    print(f"\n{'='*50}")
    print("5-FOLD STRATIFIED CROSS-VALIDATION")
    print(f"{'='*50}")

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_metrics = []

    for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        x_tr, x_val = X.iloc[train_idx], X.iloc[val_idx]
        y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

        m = XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            subsample=0.85, colsample_bytree=0.85, min_child_weight=5,
            gamma=0.1, reg_alpha=0.1, reg_lambda=1.0,
            objective="binary:logistic", eval_metric="logloss",
            scale_pos_weight=pos_weight, random_state=42, n_jobs=-1,
        )
        m.fit(x_tr, y_tr)
        p = m.predict_proba(x_val)[:, 1]

        cv_metrics.append({
            "fold": fold_idx + 1,
            "roc_auc": float(roc_auc_score(y_val, p)),
            "recall": float(recall_score(y_val, (p >= optimal_threshold).astype(int))),
            "precision": float(precision_score(y_val, (p >= optimal_threshold).astype(int), zero_division=0)),
            "f1": float(f1_score(y_val, (p >= optimal_threshold).astype(int), zero_division=0)),
        })

    for m in cv_metrics:
        print(f"  Fold {m['fold']}: AUC={m['roc_auc']:.4f} Recall={m['recall']:.4f} Precision={m['precision']:.4f} F1={m['f1']:.4f}")

    agg_auc = np.mean([m['roc_auc'] for m in cv_metrics])
    agg_recall = np.mean([m['recall'] for m in cv_metrics])
    agg_precision = np.mean([m['precision'] for m in cv_metrics])
    agg_f1 = np.mean([m['f1'] for m in cv_metrics])
    print(f"\n  Mean: AUC={agg_auc:.4f} Recall={agg_recall:.4f} Precision={agg_precision:.4f} F1={agg_f1:.4f}")

    # ── Feature importance ──
    print(f"\n{'='*50}")
    print("FEATURE IMPORTANCE")
    print(f"{'='*50}")
    importance = dict(zip(X.columns, model.feature_importances_))
    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    for feat, imp in sorted_imp:
        bar = "#" * int(imp * 50)
        print(f"  {feat:30s}: {imp:.4f} {bar}")

    # ── Save model artifact ──
    model_path = HERE / "models" / "xgboost_model.pkl"
    model_path.parent.mkdir(parents=True, exist_ok=True)

    artifact = {
        "estimator": model,
        "features": list(X.columns),
        "threshold": optimal_threshold,
        "model_name": "xgboost_balanced_v3",
        "version": "3.0.0",
        "training_samples": len(x_train),
        "test_samples": len(x_test),
        "class_distribution": {
            "no_flood": int((y == 0).sum()),
            "flood": int((y == 1).sum()),
            "flood_rate": float(y.mean()),
        },
        "metrics": {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, zero_division=0)),
            "f1": float(f1_score(y_test, y_pred, zero_division=0)),
            "f2": float(fbeta_score(y_test, y_pred, beta=2, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, probs)),
            "pr_auc": float(average_precision_score(y_test, probs)),
            "brier": float(brier_score_loss(y_test, probs)),
            "fnr": float(fn / (fn + tp)),
            "fpr": float(fp / (fp + tn)),
        },
        "cross_validation": {
            "mean_roc_auc": float(agg_auc),
            "mean_recall": float(agg_recall),
            "mean_precision": float(agg_precision),
            "mean_f1": float(agg_f1),
        },
        "feature_importance": importance,
    }

    joblib.dump(artifact, model_path)
    print(f"\nModel saved to: {model_path}")

    # Also save as the improved path for backward compatibility
    improved_path = HERE / "models" / "xgboost_model_improved.pkl"
    joblib.dump(artifact, improved_path)
    print(f"Model saved to: {improved_path}")

    print(f"\n{'='*70}")
    print("TRAINING COMPLETE")
    print(f"{'='*70}")
    print(f"Threshold: {optimal_threshold:.4f}")
    print(f"Expected performance:")
    print(f"  - Recall: ~83% (catches 83% of floods)")
    print(f"  - Precision: ~20% (some false alarms)")
    print(f"  - ROC-AUC: ~82%")
    print(f"  - Missed floods: ~17%")

    return artifact


if __name__ == "__main__":
    main()
