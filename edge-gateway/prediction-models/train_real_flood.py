"""Retrain the deployed flood model on the REAL DMC gauge dataset.

Dataset : edge-gateway/resources/sri_lanka_flood_real_dataset.csv
          (built by build_real_flood_dataset.py — real DMC water-level reports,
           real ERA5 rainfall, real SRTM elevation, real flood labels)

Serving consistency (matches base_model.predict_one / SimulationModal):
  - monthly_rainfall_mm = 0.0 for all rows (modal/API does not send it;
    predict_one default is 0.0)
  - drainage_index      = 0.5 constant (serving default)
  - water_level_m       = real gauge stage (camp passes nearest-gauge level)
  - elevation_ratio     = elevation / gauge_minor_level (serving formula)
  - distance_to_river_m = 0 for gauge rows (station sits on the river; feature
    is constant in training so the model ignores it at inference too)

Validation: temporal 3-way split by report date (first 60% train, next 20%
validation, last 20% untouched test). The F2 decision threshold is selected on
the VALIDATION split only (disaster use-case: miss cost > false-alarm cost;
F1-optimal threshold also recorded for comparison). The final model is
evaluated ONCE on the untouched test split at the frozen validation threshold.
CalibratedClassifierCV(sigmoid, cv=3) is fit on the train split only.

Artifact is saved to models/xgboost_model_improved.pkl (same dict keys as the
previous trainer). The prior model is backed up locally first as
models/xgboost_model_improved.synthetic25k.pkl (gitignored, not deployed).
"""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from xgboost import XGBClassifier

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "resources" / "sri_lanka_flood_real_dataset.csv"
MODEL_PATH = HERE / "models" / "xgboost_model_improved.pkl"
BACKUP_PATH = HERE / "models" / "xgboost_model_improved.synthetic25k.pkl"
REPORT_PATH = HERE / "real_validation_results" / "retrain_real_metrics.json"

# Must match base_model.EXTENDED_FEATURES (order matters for the artifact)
FEATURES = [
    "rainfall_7d_mm", "longitude", "latitude", "elevation_m",
    "distance_to_river_m", "monthly_rainfall_mm", "drainage_index",
    "water_level_m", "elevation_ratio", "river_proximity_score",
]


def find_threshold_fbeta(y, p, beta=2.0):
    precision, recall, thr = precision_recall_curve(y, p)
    f = ((1 + beta ** 2) * precision * recall
         / (beta ** 2 * precision + recall + 1e-12))[: len(thr)]
    return float(thr[int(np.nanargmax(f))])


def find_threshold_recall(y, p, target=0.90):
    precision, recall, thr = precision_recall_curve(y, p)
    ok = recall[:-1] >= target
    if not ok.any():
        return 0.1
    return float(np.max(thr[ok]))


def metrics_at(y, p, thr):
    pred = (p >= thr).astype(int)
    return {
        "threshold": float(thr),
        "accuracy": float((pred == y).mean()),
        "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred, zero_division=0)),
        "f1": float(f1_score(y, pred, zero_division=0)),
        "confusion_matrix": confusion_matrix(y, pred).tolist(),
    }


def build_estimator(scale_pos_weight):
    return XGBClassifier(
        n_estimators=400, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
        scale_pos_weight=scale_pos_weight,
        eval_metric="logloss", random_state=42,
    )


def main():
    df = pd.read_csv(DATA)
    df = df[df["flood_label"] >= 0].reset_index(drop=True)
    df["monthly_rainfall_mm"] = 0.0  # match serving default (modal sends none)

    X = df[FEATURES]
    y = df["flood_label"].astype(int)

    dates = sorted(df["report_date"].unique())
    n = len(dates)
    cut_train = dates[int(n * 0.6)]
    cut_val = dates[int(n * 0.8)]
    tr_mask = df["report_date"] < cut_train
    va_mask = (df["report_date"] >= cut_train) & (df["report_date"] < cut_val)
    te_mask = df["report_date"] >= cut_val
    X_tr, y_tr = X[tr_mask], y[tr_mask]
    X_va, y_va = X[va_mask], y[va_mask]
    X_te, y_te = X[te_mask], y[te_mask]
    print(f"rows={len(df)}  pos={int(y.sum())} ({y.mean():.1%})")
    print(f"temporal split: train<{cut_train} {len(X_tr)} ({int(y_tr.sum())} pos)  "
          f"val {cut_train}..{cut_val} {len(X_va)} ({int(y_va.sum())} pos)  "
          f"test>={cut_val} {len(X_te)} ({int(y_te.sum())} pos)")

    spw = float((y_tr == 0).sum() / max((y_tr == 1).sum(), 1))
    base = build_estimator(spw)
    base.fit(X_tr, y_tr)

    calibrated = CalibratedClassifierCV(base, method="sigmoid", cv=3)
    calibrated.fit(X_tr, y_tr)

    # --- threshold selection on VALIDATION split only ---
    p_va = calibrated.predict_proba(X_va)[:, 1]
    thr_f2 = find_threshold_fbeta(y_va, p_va, beta=2.0)
    thr_f1 = find_threshold_fbeta(y_va, p_va, beta=1.0)
    m_va = metrics_at(y_va.values, p_va, thr_f2)
    print(f"\nvalidation: F2-threshold={thr_f2:.3f} -> P={m_va['precision']:.3f} "
          f"R={m_va['recall']:.3f} F1={m_va['f1']:.3f}  CM={m_va['confusion_matrix']}")
    print(f"validation: F1-optimal threshold would be {thr_f1:.3f}")

    # --- final evaluation on UNTOUCHED test at frozen validation threshold ---
    p_te = calibrated.predict_proba(X_te)[:, 1]
    auc = roc_auc_score(y_te, p_te)
    ap = average_precision_score(y_te, p_te)
    m = metrics_at(y_te.values, p_te, thr_f2)
    print(f"untouched test @ validation threshold {thr_f2:.3f}: ROC-AUC={auc:.3f}  PR-AUC={ap:.3f}")
    print(f"  P={m['precision']:.3f} R={m['recall']:.3f} F1={m['f1']:.3f}  CM={m['confusion_matrix']}")

    # feature importance (informational fit on all rows; not deployed)
    probe = build_estimator(spw)
    probe.fit(X, y)
    imp = dict(zip(FEATURES, probe.feature_importances_))
    print("\nfeature importance (probe fit):")
    for k, v in sorted(imp.items(), key=lambda kv: -kv[1]):
        print(f"  {k:26s} {v:.4f} {'#' * int(v * 40)}")

    metrics = {**m, "roc_auc": float(auc), "pr_auc": float(ap)}

    if MODEL_PATH.exists() and not BACKUP_PATH.exists():
        prev = joblib.load(MODEL_PATH)
        if "real" not in str(prev.get("model_name", "")):
            shutil.copy2(MODEL_PATH, BACKUP_PATH)
            print(f"\nbacked up old (synthetic) model -> {BACKUP_PATH.name}")
        else:
            print("\nskipped backup: current model is already a real-data model")

    artifact = {
        "estimator": calibrated,
        "features": list(FEATURES),
        "threshold": thr_f2,
        "metrics": metrics,
        "model_name": "xgboost_real_dmc_v1",
        "training_samples": int(len(X_tr)),
        "class_distribution": {"no_flood": int((y_tr == 0).sum()),
                               "flood": int((y_tr == 1).sum())},
        "dataset": DATA.name,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "notes": "trained on real DMC gauge reports; F2 threshold selected on "
                 "validation split, test evaluated once at frozen threshold; "
                 "features match base_model.predict_one serving derivation",
    }
    joblib.dump(artifact, MODEL_PATH)
    print(f"artifact saved -> {MODEL_PATH}")

    REPORT_PATH.write_text(json.dumps({
        "dataset": DATA.name, "rows": int(len(df)), "positives": int(y.sum()),
        "temporal_split": {"train_before": str(cut_train),
                           "validation_range": f"{cut_train} .. {cut_val}",
                           "test_from": str(cut_val)},
        "train_rows": int(len(X_tr)), "validation_rows": int(len(X_va)),
        "test_rows": int(len(X_te)),
        "threshold_selection": {
            "method": "F2-optimal on VALIDATION split only (disaster use-case: "
                      "recall weighted higher than precision)",
            "threshold_f2": thr_f2,
            "threshold_f1_optimal_on_validation": thr_f1,
            "validation_metrics_at_f2_threshold": m_va,
        },
        "test_metrics_at_frozen_validation_threshold": metrics,
        "feature_importance": {k: round(float(v), 4) for k, v in imp.items()},
        "backup_old_model": BACKUP_PATH.name if BACKUP_PATH.exists() else None,
        "trained_at": artifact["trained_at"],
    }, indent=2))
    print(f"report saved -> {REPORT_PATH.name}")


if __name__ == "__main__":
    main()
