"""Generate model evaluation visualizations for the optimized flood prediction model."""
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
import joblib
from sklearn.metrics import (
    confusion_matrix, roc_curve, auc, precision_recall_curve,
    average_precision_score, accuracy_score, precision_score,
    recall_score, f1_score, roc_auc_score, classification_report,
)
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from base_model import DATASET_PATH

SAFE_FEATURES = [
    "rainfall_7d_mm", "longitude", "latitude", "elevation_m",
    "distance_to_river_m", "monthly_rainfall_mm", "drainage_index",
]
DERIVED_FEATURES = ["water_level_m", "elevation_ratio", "river_proximity_score"]
ALL_FEATURES = SAFE_FEATURES + DERIVED_FEATURES

OUTPUT_DIR = HERE / "comparison_results"
OUTPUT_DIR.mkdir(exist_ok=True)


def load_data():
    data = pd.read_csv(DATASET_PATH)
    target = data["flood_occurrence_current_event"].map({"Yes": 1, "No": 0}).astype(int)
    features = data[SAFE_FEATURES].copy()
    features = features.fillna(features.median(numeric_only=True))
    rain_norm = features["rainfall_7d_mm"] / max(features["rainfall_7d_mm"].max(), 1)
    elev_inv = 1.0 - (features["elevation_m"] / max(features["elevation_m"].max(), 1))
    river_close = 1.0 - (features["distance_to_river_m"] / max(features["distance_to_river_m"].max(), 1))
    features["water_level_m"] = (rain_norm * 0.4 + elev_inv * 0.3 + river_close * 0.3) * 8.0
    mean_elev = features["elevation_m"].mean()
    features["elevation_ratio"] = features["elevation_m"] / mean_elev if mean_elev > 0 else 1.0
    features["river_proximity_score"] = 1000.0 / features["distance_to_river_m"].clip(lower=1.0)
    return features[ALL_FEATURES], target


def main():
    X, y = load_data()
    x_train, x_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model_path = HERE / "models" / "xgboost_model.pkl"
    artifact = joblib.load(model_path)
    estimator = artifact["estimator"]
    threshold = artifact.get("threshold", 0.5)

    probs = estimator.predict_proba(x_test)[:, 1]
    preds = (probs >= threshold).astype(int)

    cm = confusion_matrix(y_test, preds)
    tn, fp, fn, tp = cm.ravel()

    acc = accuracy_score(y_test, preds)
    prec = precision_score(y_test, preds, zero_division=0)
    rec = recall_score(y_test, preds, zero_division=0)
    f1 = f1_score(y_test, preds, zero_division=0)
    roc_auc = roc_auc_score(y_test, probs)
    pr_auc = average_precision_score(y_test, probs)

    sns.set_style("whitegrid")
    plt.rcParams.update({
        "font.size": 12,
        "axes.titlesize": 14,
        "axes.labelsize": 12,
        "figure.facecolor": "white",
    })

    # ═══════════════════════════════════════════════════════════════
    # FIGURE 1: CONFUSION MATRIX
    # ═══════════════════════════════════════════════════════════════
    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", cbar=True,
                xticklabels=["No Flood", "Flood"], yticklabels=["No Flood", "Flood"],
                annot_kws={"size": 18, "weight": "bold"}, ax=ax)
    ax.set_title("Confusion Matrix", fontsize=16, fontweight="bold", pad=15)
    ax.set_ylabel("Actual", fontsize=13)
    ax.set_xlabel("Predicted", fontsize=13)
    total = cm.sum()
    ax.text(0, -0.15, f"TN={tn}  FP={fp}", fontsize=11, ha="left", transform=ax.transData)
    ax.text(1, -0.15, f"FN={fn}  TP={tp}", fontsize=11, ha="right", transform=ax.transData)
    plt.tight_layout()
    fig.savefig(OUTPUT_DIR / "confusion_matrix.png", dpi=200, bbox_inches="tight")
    plt.close()
    print(f"Saved: {OUTPUT_DIR / 'confusion_matrix.png'}")

    # ═══════════════════════════════════════════════════════════════
    # FIGURE 2: ROC CURVE
    # ═══════════════════════════════════════════════════════════════
    fpr, tpr, _ = roc_curve(y_test, probs)
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.plot(fpr, tpr, color="#2196F3", lw=2.5, label=f"ROC Curve (AUC = {roc_auc:.4f})")
    ax.fill_between(fpr, tpr, alpha=0.15, color="#2196F3")
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", lw=1.2, label="Random (AUC = 0.5)")
    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.05])
    ax.set_xlabel("False Positive Rate", fontsize=13)
    ax.set_ylabel("True Positive Rate", fontsize=13)
    ax.set_title("ROC Curve - Flood Prediction", fontsize=16, fontweight="bold", pad=15)
    ax.legend(loc="lower right", fontsize=12)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    fig.savefig(OUTPUT_DIR / "roc_curve.png", dpi=200, bbox_inches="tight")
    plt.close()
    print(f"Saved: {OUTPUT_DIR / 'roc_curve.png'}")

    # ═══════════════════════════════════════════════════════════════
    # FIGURE 3: PRECISION-RECALL CURVE
    # ═══════════════════════════════════════════════════════════════
    prec_arr, rec_arr, _ = precision_recall_curve(y_test, probs)
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.plot(rec_arr, prec_arr, color="#4CAF50", lw=2.5, label=f"PR Curve (AP = {pr_auc:.4f})")
    ax.fill_between(rec_arr, prec_arr, alpha=0.15, color="#4CAF50")
    ax.axhline(y=y_test.mean(), color="gray", linestyle="--", lw=1.2, label=f"Baseline ({y_test.mean():.2f})")
    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.05])
    ax.set_xlabel("Recall", fontsize=13)
    ax.set_ylabel("Precision", fontsize=13)
    ax.set_title("Precision-Recall Curve - Flood Prediction", fontsize=16, fontweight="bold", pad=15)
    ax.legend(loc="upper right", fontsize=12)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    fig.savefig(OUTPUT_DIR / "precision_recall_curve.png", dpi=200, bbox_inches="tight")
    plt.close()
    print(f"Saved: {OUTPUT_DIR / 'precision_recall_curve.png'}")

    # ═══════════════════════════════════════════════════════════════
    # FIGURE 4: METRICS BAR CHART
    # ═══════════════════════════════════════════════════════════════
    metrics_names = ["Accuracy", "Precision", "Recall", "F1 Score", "ROC-AUC", "PR-AUC"]
    metrics_values = [acc, prec, rec, f1, roc_auc, pr_auc]
    colors = ["#2196F3", "#FF9800", "#4CAF50", "#9C27B0", "#F44336", "#00BCD4"]

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.bar(metrics_names, metrics_values, color=colors, width=0.6, edgecolor="white", linewidth=1.5)
    for bar, val in zip(bars, metrics_values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.01,
                f"{val:.4f}", ha="center", va="bottom", fontsize=12, fontweight="bold")
    ax.set_ylim(0, 1.15)
    ax.set_ylabel("Score", fontsize=13)
    ax.set_title("Model Performance Metrics", fontsize=16, fontweight="bold", pad=15)
    ax.axhline(y=0.9, color="red", linestyle="--", lw=1, alpha=0.5, label="90% Target")
    ax.legend(fontsize=11)
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    fig.savefig(OUTPUT_DIR / "metrics_summary.png", dpi=200, bbox_inches="tight")
    plt.close()
    print(f"Saved: {OUTPUT_DIR / 'metrics_summary.png'}")

    # ═══════════════════════════════════════════════════════════════
    # FIGURE 5: FEATURE IMPORTANCE
    # ═══════════════════════════════════════════════════════════════
    importance = artifact.get("feature_importance", {})
    if not importance and hasattr(estimator, "feature_importances_"):
        importance = dict(zip(X.columns, estimator.feature_importances_))
    if importance:
        sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)
        feat_names = [f[0] for f in sorted_imp]
        feat_vals = [f[1] for f in sorted_imp]

        fig, ax = plt.subplots(figsize=(10, 6))
        colors_fi = plt.cm.viridis(np.linspace(0.3, 0.9, len(feat_names)))
        bars = ax.barh(range(len(feat_names)), feat_vals, color=colors_fi, height=0.6, edgecolor="white", linewidth=1)
        ax.set_yticks(range(len(feat_names)))
        ax.set_yticklabels(feat_names, fontsize=11)
        ax.invert_yaxis()
        for bar, val in zip(bars, feat_vals):
            ax.text(val + 0.003, bar.get_y() + bar.get_height() / 2,
                    f"{val:.4f}", va="center", fontsize=11, fontweight="bold")
        ax.set_xlabel("Importance", fontsize=13)
        ax.set_title("Feature Importance", fontsize=16, fontweight="bold", pad=15)
        ax.grid(axis="x", alpha=0.3)
        plt.tight_layout()
        fig.savefig(OUTPUT_DIR / "feature_importance.png", dpi=200, bbox_inches="tight")
        plt.close()
        print(f"Saved: {OUTPUT_DIR / 'feature_importance.png'}")

    # ═══════════════════════════════════════════════════════════════
    # FIGURE 6: PROBABILITY DISTRIBUTION
    # ═══════════════════════════════════════════════════════════════
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.hist(probs[y_test == 0], bins=50, alpha=0.6, color="#2196F3", label="No Flood", density=True)
    ax.hist(probs[y_test == 1], bins=50, alpha=0.6, color="#F44336", label="Flood", density=True)
    ax.axvline(x=threshold, color="black", linestyle="--", lw=2, label=f"Threshold = {threshold:.4f}")
    ax.set_xlabel("Predicted Probability", fontsize=13)
    ax.set_ylabel("Density", fontsize=13)
    ax.set_title("Prediction Probability Distribution", fontsize=16, fontweight="bold", pad=15)
    ax.legend(fontsize=12)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    fig.savefig(OUTPUT_DIR / "probability_distribution.png", dpi=200, bbox_inches="tight")
    plt.close()
    print(f"Saved: {OUTPUT_DIR / 'probability_distribution.png'}")

    # ═══════════════════════════════════════════════════════════════
    # FIGURE 7: COMBINED DASHBOARD
    # ═══════════════════════════════════════════════════════════════
    fig, axes = plt.subplots(2, 3, figsize=(20, 12))
    fig.suptitle("Flood Prediction Model - Evaluation Dashboard", fontsize=18, fontweight="bold", y=0.98)

    # 1. Confusion Matrix
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", cbar=False,
                xticklabels=["No Flood", "Flood"], yticklabels=["No Flood", "Flood"],
                annot_kws={"size": 14, "weight": "bold"}, ax=axes[0, 0])
    axes[0, 0].set_title("Confusion Matrix", fontsize=13, fontweight="bold")
    axes[0, 0].set_ylabel("Actual")
    axes[0, 0].set_xlabel("Predicted")

    # 2. ROC Curve
    axes[0, 1].plot(fpr, tpr, color="#2196F3", lw=2, label=f"AUC = {roc_auc:.4f}")
    axes[0, 1].fill_between(fpr, tpr, alpha=0.15, color="#2196F3")
    axes[0, 1].plot([0, 1], [0, 1], "--", color="gray", lw=1)
    axes[0, 1].set_title("ROC Curve", fontsize=13, fontweight="bold")
    axes[0, 1].set_xlabel("False Positive Rate")
    axes[0, 1].set_ylabel("True Positive Rate")
    axes[0, 1].legend(fontsize=11)
    axes[0, 1].grid(True, alpha=0.3)

    # 3. PR Curve
    axes[0, 2].plot(rec_arr, prec_arr, color="#4CAF50", lw=2, label=f"AP = {pr_auc:.4f}")
    axes[0, 2].fill_between(rec_arr, prec_arr, alpha=0.15, color="#4CAF50")
    axes[0, 2].axhline(y=y_test.mean(), color="gray", linestyle="--", lw=1)
    axes[0, 2].set_title("Precision-Recall Curve", fontsize=13, fontweight="bold")
    axes[0, 2].set_xlabel("Recall")
    axes[0, 2].set_ylabel("Precision")
    axes[0, 2].legend(fontsize=11)
    axes[0, 2].grid(True, alpha=0.3)

    # 4. Metrics Bar Chart
    bars = axes[1, 0].bar(metrics_names, metrics_values, color=colors, width=0.6, edgecolor="white", linewidth=1.5)
    for bar, val in zip(bars, metrics_values):
        axes[1, 0].text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.01,
                        f"{val:.3f}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    axes[1, 0].set_ylim(0, 1.15)
    axes[1, 0].set_title("Performance Metrics", fontsize=13, fontweight="bold")
    axes[1, 0].axhline(y=0.9, color="red", linestyle="--", lw=1, alpha=0.5)
    axes[1, 0].grid(axis="y", alpha=0.3)
    axes[1, 0].tick_params(axis="x", rotation=25)

    # 5. Feature Importance
    if importance:
        axes[1, 1].barh(range(len(feat_names)), feat_vals, color=colors_fi, height=0.6)
        axes[1, 1].set_yticks(range(len(feat_names)))
        axes[1, 1].set_yticklabels(feat_names, fontsize=9)
        axes[1, 1].invert_yaxis()
        axes[1, 1].set_title("Feature Importance", fontsize=13, fontweight="bold")
        axes[1, 1].set_xlabel("Importance")

    # 6. Probability Distribution
    axes[1, 2].hist(probs[y_test == 0], bins=40, alpha=0.6, color="#2196F3", label="No Flood", density=True)
    axes[1, 2].hist(probs[y_test == 1], bins=40, alpha=0.6, color="#F44336", label="Flood", density=True)
    axes[1, 2].axvline(x=threshold, color="black", linestyle="--", lw=2, label=f"Threshold={threshold:.4f}")
    axes[1, 2].set_title("Probability Distribution", fontsize=13, fontweight="bold")
    axes[1, 2].set_xlabel("Predicted Probability")
    axes[1, 2].set_ylabel("Density")
    axes[1, 2].legend(fontsize=10)
    axes[1, 2].grid(True, alpha=0.3)

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    fig.savefig(OUTPUT_DIR / "model_dashboard.png", dpi=200, bbox_inches="tight")
    plt.close()
    print(f"Saved: {OUTPUT_DIR / 'model_dashboard.png'}")

    print(f"\n{'='*60}")
    print("ALL VISUALIZATIONS GENERATED SUCCESSFULLY")
    print(f"{'='*60}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"\nFiles saved:")
    for f in sorted(OUTPUT_DIR.glob("*.png")):
        print(f"  {f.name}")


if __name__ == "__main__":
    main()
