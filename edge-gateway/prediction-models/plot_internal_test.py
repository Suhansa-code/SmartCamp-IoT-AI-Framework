"""Plot ROC + confusion matrix for the INTERNAL temporal test split — two ways.

Same untouched test split (report_date >= test_from), same trained artifact.
Because labels come from DMC gauge status (stage >= minor => flood) and
water_level_m is a feature, an "as-deployed" score largely reflects that rule.
So we ALSO score the test split forecast-only (water_level_m = 0 for every
row, derived altitude features recomputed) — the serving path when no live
gauge reading exists. That is the honest generalization estimate.

Saves to real_validation_results/internal_test/:
  roc_internal_test_with_gauge.png / confusion_matrix_internal_test_with_gauge.png
  roc_internal_test_no_gauge.png   / confusion_matrix_internal_test_no_gauge.png
  internal_test_metrics.json
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
    roc_curve,
)

BASE = Path(__file__).resolve().parent
DATA = BASE.parent / "resources" / "sri_lanka_flood_real_dataset.csv"
MODEL = BASE / "models" / "xgboost_model_improved.pkl"
RETRAIN = BASE / "real_validation_results" / "retrain_real_metrics.json"
OUT = BASE / "real_validation_results" / "internal_test"


def derive_altitude_features(df: pd.DataFrame) -> pd.DataFrame:
    """Same derivation as train_real_flood.py / base_model serving."""
    df = df.copy()
    minor = df["minor_flood_level_m"].clip(lower=0.1)
    df["elev_above_minor_m"] = df["elevation_m"] - minor
    df["water_to_elev_ratio"] = df["water_level_m"] / np.maximum(df["elevation_m"], 1.0)
    df["stage_above_camp_m"] = df["water_level_m"] - df["elevation_m"]
    return df


def evaluate(y, probs, thr):
    preds = (probs >= thr).astype(int)
    p, r, f1, _ = precision_recall_fscore_support(
        y, preds, average="binary", zero_division=0)
    return {
        "roc_auc": float(roc_auc_score(y, probs)),
        "average_precision": float(average_precision_score(y, probs)),
        "precision": float(p), "recall": float(r), "f1": float(f1),
        "confusion_matrix": confusion_matrix(y, preds).tolist(),
    }


def plot_roc(y, probs, thr_tag, title, fname):
    auc = roc_auc_score(y, probs)
    ap = average_precision_score(y, probs)
    fpr, tpr, _ = roc_curve(y, probs)
    plt.figure(figsize=(6.0, 4.6))
    plt.plot(fpr, tpr, color="#059669", lw=2,
             label=f"Model (AUC = {auc:.3f}, AP = {ap:.3f})")
    plt.plot([0, 1], [0, 1], color="#9CA3AF", lw=1, ls="--", label="Random")
    plt.xlim(-0.02, 1.02); plt.ylim(-0.02, 1.02)
    plt.xlabel("False Positive Rate", fontsize=10)
    plt.ylabel("True Positive Rate", fontsize=10)
    plt.title(title, fontsize=9.5)
    plt.legend(loc="lower right", fontsize=9)
    plt.tight_layout()
    plt.savefig(OUT / fname, dpi=150)
    plt.close()


def plot_cm(y, probs, thr, subtitle, fname):
    cm = confusion_matrix(y, (probs >= thr).astype(int))
    tn, fp, fn, tp = cm.ravel()
    plt.figure(figsize=(4.8, 4.2))
    plt.imshow(cm, cmap="Blues")
    for (i, j), v in np.ndenumerate(cm):
        plt.text(j, i, str(v), ha="center", va="center",
                 color="white" if v > cm.max() * 0.55 else "black", fontsize=16)
    plt.xticks([0, 1], ["No flood", "Flood"])
    plt.yticks([0, 1], ["No flood", "Flood"])
    plt.xlabel("Predicted", fontsize=10)
    plt.ylabel("Actual", fontsize=10)
    plt.title(f"Confusion matrix — internal temporal test\n"
              f"{subtitle} @ thr {thr:.3f}\n"
              f"TN={tn}  FP={fp}  FN={fn}  TP={tp}", fontsize=9)
    plt.tight_layout()
    plt.savefig(OUT / fname, dpi=150)
    plt.close()
    return cm


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    rep = json.loads(RETRAIN.read_text())
    cut_val = rep["temporal_split"]["test_from"]
    thr = float(rep["threshold_selection"]["threshold_f2"])

    art = joblib.load(MODEL)
    features, estimator = art["features"], art["estimator"]

    df = pd.read_csv(DATA)
    df = df[df["flood_label"] >= 0].reset_index(drop=True)
    df["monthly_rainfall_mm"] = 0.0
    df = derive_altitude_features(df)
    te = df[df["report_date"] >= cut_val].reset_index(drop=True)
    y = te["flood_label"].astype(int)

    # A) as-deployed: real gauge stage available (serves the DMC status rule)
    probs_gauge = estimator.predict_proba(te[features])[:, 1]
    m_gauge = evaluate(y, probs_gauge, thr)

    # B) forecast-only: no gauge reading (serving default water_level_m = 0)
    te_ng = te.copy()
    te_ng["water_level_m"] = 0.0
    te_ng = derive_altitude_features(te_ng)
    probs_nogauge = estimator.predict_proba(te_ng[features])[:, 1]
    m_nogauge = evaluate(y, probs_nogauge, thr)

    n = len(te); pos = int(y.sum())
    print(f"test rows={n}  pos={pos}  thr={thr:.3f}  features={len(features)}")
    print(f"with gauge: AUC={m_gauge['roc_auc']:.3f} P={m_gauge['precision']:.3f} "
          f"R={m_gauge['recall']:.3f} F1={m_gauge['f1']:.3f} CM={m_gauge['confusion_matrix']}")
    print(f"no gauge  : AUC={m_nogauge['roc_auc']:.3f} P={m_nogauge['precision']:.3f} "
          f"R={m_nogauge['recall']:.3f} F1={m_nogauge['f1']:.3f} CM={m_nogauge['confusion_matrix']}")

    plot_roc(y, probs_gauge, thr,
             f"ROC — internal temporal test, WITH gauge stage (n={n}, {pos} floods)\n"
             f"largely reflects the DMC gauge-status rule the labels come from",
             "roc_internal_test_with_gauge.png")
    plot_cm(y, probs_gauge, thr, "with gauge stage\n(reflects DMC status rule)",
            "confusion_matrix_internal_test_with_gauge.png")

    plot_roc(y, probs_nogauge, thr,
             f"ROC — internal temporal test, NO gauge (forecast-only, n={n}, {pos} floods)\n"
             f"honest generalization without the label-defining gauge reading",
             "roc_internal_test_no_gauge.png")
    plot_cm(y, probs_nogauge, thr, "no gauge (forecast-only)",
            "confusion_matrix_internal_test_no_gauge.png")

    (OUT / "internal_test_metrics.json").write_text(json.dumps({
        "model_artifact": MODEL.name,
        "model_trained_at": art.get("trained_at"),
        "split": rep["temporal_split"],
        "threshold": thr,
        "threshold_source": "F2-optimal on validation split (retrain_real_metrics.json)",
        "n_features": len(features),
        "test_rows": n,
        "test_positives": pos,
        "with_gauge_stage": {
            "meaning": "real water_level_m kept — as-deployed when operator "
                       "reports the gauge; labels themselves derive from this "
                       "gauge status, so metrics largely reflect that rule",
            **m_gauge,
        },
        "forecast_only_no_gauge": {
            "meaning": "water_level_m = 0 for every test row (serving default "
                       "without a live reading) — honest generalization",
            **m_nogauge,
        },
    }, indent=2))
    print(f"saved -> {OUT}/ (4 charts + internal_test_metrics.json)")


if __name__ == "__main__":
    main()
