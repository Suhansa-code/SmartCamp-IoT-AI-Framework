"""
train_and_validate.py — Comprehensive model training, cross-validation,
model comparison, ablation study, and scenario testing.

Usage:
    python train_and_validate.py
    python train_and_validate.py --skip-cv
    python train_and_validate.py --ablation-only
"""
import json
import sys
import argparse
import warnings
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report,
)
from sklearn.model_selection import train_test_split, StratifiedKFold

warnings.filterwarnings("ignore", category=UserWarning)

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from base_model import BASE_FEATURES, EXTENDED_FEATURES, MODEL_FEATURES, DATASET_PATH, MODELS_DIR
from xgboost_model.xgboost_model import LocationAwareFloodXGBoostModel
from random_forest_model.random_forest_model import LocationAwareFloodRandomForestModel
from decision_tree_model.decision_tree_model import LocationAwareFloodDecisionTreeModel
from logistic_regression_model.logistic_regression_model import LocationAwareFloodLogisticModel

OUTPUT_DIR = HERE / "comparison_results"
OUTPUT_DIR.mkdir(exist_ok=True)


# ── Data loading ─────────────────────────────────────────────────────────

def load_data():
    data = pd.read_csv(DATASET_PATH)
    target = data["flood_occurrence_current_event"].map({"Yes": 1, "No": 0})
    y = target.astype(int)

    base_X = data[BASE_FEATURES].copy().fillna(data[BASE_FEATURES].median(numeric_only=True))

    # Build extended features from raw columns (avoid data leakage)
    ext_data = data[BASE_FEATURES].copy()
    ext_data = ext_data.fillna(ext_data.median(numeric_only=True))

    # water_level_m: synthetic based on hydrological relationships
    # Higher rainfall + lower elevation + closer to river = higher water level
    rain_norm = ext_data["rainfall_7d_mm"] / ext_data["rainfall_7d_mm"].max()
    elev_inv = 1.0 - (ext_data["elevation_m"] / ext_data["elevation_m"].max())
    river_close = 1.0 - (ext_data["distance_to_river_m"] / ext_data["distance_to_river_m"].max())
    ext_data["water_level_m"] = (rain_norm * 0.4 + elev_inv * 0.3 + river_close * 0.3) * 8.0

    # elevation_ratio: elevation_m / (mean elevation of dataset)
    mean_elev = ext_data["elevation_m"].mean()
    ext_data["elevation_ratio"] = ext_data["elevation_m"] / mean_elev if mean_elev > 0 else 1.0

    # river_proximity_score: 1000 / distance_to_river_m (closer = higher)
    ext_data["river_proximity_score"] = 1000.0 / ext_data["distance_to_river_m"].clip(lower=1.0)

    ext_X = ext_data[EXTENDED_FEATURES]

    return base_X, ext_X, y, data


# ── 1. Train all 4 models with extended features ────────────────────────

def train_all_models(X, y) -> Dict[str, dict]:
    print("=" * 70)
    print("PHASE 1: Training all 4 models with extended features (8 features)")
    print("=" * 70)

    x_train, x_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )

    models = {
        "xgboost": LocationAwareFloodXGBoostModel(),
        "random_forest": LocationAwareFloodRandomForestModel(),
        "decision_tree": LocationAwareFloodDecisionTreeModel(),
        "logistic_regression": LocationAwareFloodLogisticModel(),
    }

    results = {}
    for name, model in models.items():
        print(f"\n  Training {name}...")
        model._estimator = model._build_estimator()
        model._fit(model._estimator, x_train, y_train)
        model._is_trained = True

        probs = model._predict_proba(model._estimator, x_test)
        preds = (probs >= 0.5).astype(int)

        results[name] = {
            "accuracy": float(accuracy_score(y_test, preds)),
            "precision": float(precision_score(y_test, preds, zero_division=0)),
            "recall": float(recall_score(y_test, preds, zero_division=0)),
            "f1": float(f1_score(y_test, preds, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, probs)),
            "confusion_matrix": confusion_matrix(y_test, preds).tolist(),
        }
        model.save()
        print(f"  {name}: AUC={results[name]['roc_auc']:.4f}, F1={results[name]['f1']:.4f}, Recall={results[name]['recall']:.4f}")

    return results


# ── 2. Cross-validation ─────────────────────────────────────────────────

def run_cross_validation(X, y, n_folds=5):
    print("\n" + "=" * 70)
    print(f"PHASE 2: {n_folds}-Fold Stratified Cross-Validation")
    print("=" * 70)

    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    results = {}

    models = {
        "xgboost": LocationAwareFloodXGBoostModel(),
        "random_forest": LocationAwareFloodRandomForestModel(),
        "decision_tree": LocationAwareFloodDecisionTreeModel(),
        "logistic_regression": LocationAwareFloodLogisticModel(),
    }

    for name, model in models.items():
        fold_metrics = []
        for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X, y)):
            x_train, x_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

            estimator = model._build_estimator()
            model._fit(estimator, x_train, y_train)
            probs = model._predict_proba(estimator, x_val)
            preds = (probs >= 0.5).astype(int)

            fold_metrics.append({
                "fold": fold_idx + 1,
                "roc_auc": float(roc_auc_score(y_val, probs)),
                "accuracy": float(accuracy_score(y_val, preds)),
                "precision": float(precision_score(y_val, preds, zero_division=0)),
                "recall": float(recall_score(y_val, preds, zero_division=0)),
                "f1": float(f1_score(y_val, preds, zero_division=0)),
            })

        agg = {}
        for metric in ["roc_auc", "accuracy", "precision", "recall", "f1"]:
            values = [f[metric] for f in fold_metrics]
            agg[metric] = {"mean": float(np.mean(values)), "std": float(np.std(values))}

        results[name] = {"fold_metrics": fold_metrics, "aggregated": agg}
        print(f"\n  {name}:")
        print(f"    ROC-AUC: {agg['roc_auc']['mean']:.4f} ± {agg['roc_auc']['std']:.4f}")
        print(f"    Accuracy: {agg['accuracy']['mean']:.4f} ± {agg['accuracy']['std']:.4f}")
        print(f"    Precision: {agg['precision']['mean']:.4f} ± {agg['precision']['std']:.4f}")
        print(f"    Recall: {agg['recall']['mean']:.4f} ± {agg['recall']['std']:.4f}")
        print(f"    F1: {agg['f1']['mean']:.4f} ± {agg['f1']['std']:.4f}")

    return results


# ── 3. Ablation study ───────────────────────────────────────────────────

def run_ablation_study(X, y):
    print("\n" + "=" * 70)
    print("PHASE 3: Ablation Study (remove each feature, measure impact)")
    print("=" * 70)

    x_train, x_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )

    # Baseline with all features
    baseline_model = LocationAwareFloodXGBoostModel()
    baseline_model._estimator = baseline_model._build_estimator()
    baseline_model._fit(baseline_model._estimator, x_train, y_train)
    baseline_probs = baseline_model._predict_proba(baseline_model._estimator, x_test)
    baseline_auc = float(roc_auc_score(y_test, baseline_probs))
    print(f"\n  Baseline (all {len(EXTENDED_FEATURES)} features): ROC-AUC = {baseline_auc:.4f}")

    results = {"baseline": {"features": EXTENDED_FEATURES, "roc_auc": baseline_auc}}

    for feature in EXTENDED_FEATURES:
        ablation_features = [f for f in EXTENDED_FEATURES if f != feature]
        x_train_abl = x_train[ablation_features]
        x_test_abl = x_test[ablation_features]

        model = LocationAwareFloodXGBoostModel()
        model._estimator = model._build_estimator()
        model._fit(model._estimator, x_train_abl, y_train)
        probs = model._predict_proba(model._estimator, x_test_abl)
        auc = float(roc_auc_score(y_test, probs))

        delta = baseline_auc - auc
        results[feature] = {
            "features": ablation_features,
            "roc_auc": auc,
            "delta": delta,
        }
        direction = "v" if delta > 0 else "^" if delta < 0 else "="
        print(f"  Without {feature:30s}: ROC-AUC = {auc:.4f}  ({direction} {abs(delta):.4f})")

    return results


# ── 4. Scenario testing ─────────────────────────────────────────────────

def run_scenario_tests():
    print("\n" + "=" * 70)
    print("PHASE 4: Scenario Testing")
    print("=" * 70)

    model = LocationAwareFloodXGBoostModel()
    if (MODELS_DIR / "xgboost_model.pkl").exists():
        import joblib
        model._estimator = joblib.load(MODELS_DIR / "xgboost_model.pkl")
        model._is_trained = True
    else:
        print("  WARNING: No trained model found. Training fresh...")
        model.train()

    scenarios = [
        {"name": "Normal conditions", "rainfall_mm": 10, "elevation_m": 80, "water_level_m": 0.5, "nearest_river_m": 500, "gauge_alert_level": 4.5, "gauge_minor_level": 5.5, "gauge_major_level": 7.0},
        {"name": "Heavy rainfall", "rainfall_mm": 200, "elevation_m": 80, "water_level_m": 3.0, "nearest_river_m": 500, "gauge_alert_level": 4.5, "gauge_minor_level": 5.5, "gauge_major_level": 7.0},
        {"name": "High water level", "rainfall_mm": 10, "elevation_m": 80, "water_level_m": 5.0, "nearest_river_m": 500, "gauge_alert_level": 4.5, "gauge_minor_level": 5.5, "gauge_major_level": 7.0},
        {"name": "Low elevation + rain", "rainfall_mm": 150, "elevation_m": 5, "water_level_m": 4.0, "nearest_river_m": 200, "gauge_alert_level": 3.0, "gauge_minor_level": 4.0, "gauge_major_level": 5.5},
        {"name": "High elevation + rain", "rainfall_mm": 150, "elevation_m": 200, "water_level_m": 1.5, "nearest_river_m": 1000, "gauge_alert_level": 4.5, "gauge_minor_level": 5.5, "gauge_major_level": 7.0},
        {"name": "Near river + high water", "rainfall_mm": 50, "elevation_m": 30, "water_level_m": 5.5, "nearest_river_m": 50, "gauge_alert_level": 4.0, "gauge_minor_level": 5.0, "gauge_major_level": 7.0},
        {"name": "Distant from river", "rainfall_mm": 100, "elevation_m": 80, "water_level_m": 1.0, "nearest_river_m": 5000, "gauge_alert_level": 4.5, "gauge_minor_level": 5.5, "gauge_major_level": 7.0},
        {"name": "Flash flood scenario", "rainfall_mm": 300, "elevation_m": 10, "water_level_m": 6.5, "nearest_river_m": 100, "gauge_alert_level": 3.5, "gauge_minor_level": 4.5, "gauge_major_level": 6.0},
        {"name": "Drought conditions", "rainfall_mm": 0, "elevation_m": 100, "water_level_m": 0.1, "nearest_river_m": 2000, "gauge_alert_level": 4.5, "gauge_minor_level": 5.5, "gauge_major_level": 7.0},
        {"name": "Coastal flooding", "rainfall_mm": 80, "elevation_m": 2, "water_level_m": 4.5, "nearest_river_m": 500, "gauge_alert_level": 3.0, "gauge_minor_level": 4.0, "gauge_major_level": 5.5},
    ]

    results = []
    for s in scenarios:
        pred = model.predict_one(
            rainfall_mm=s["rainfall_mm"], longitude=80.945, latitude=7.507,
            altitude_m=s["elevation_m"], dem_elevation_m=s["elevation_m"],
            nearest_river_m=s["nearest_river_m"],
            water_level_m=s["water_level_m"], is_forecast=True,
            gauge_alert_level=s["gauge_alert_level"],
            gauge_minor_level=s["gauge_minor_level"],
            gauge_major_level=s["gauge_major_level"],
            return_shap=True,
        )
        result = {
            "name": s["name"],
            "probability": pred.probability,
            "category": pred.category,
            "flood_possibility": pred.flood_possibility,
            "shap_values": pred.shap_values,
        }
        results.append(result)
        print(f"\n  {s['name']}:")
        print(f"    Probability: {pred.probability:.4f}")
        print(f"    Category: {pred.category}")
        print(f"    Flood: {pred.flood_possibility}")
        if pred.shap_values:
            top_feature = max(pred.shap_values.items(), key=lambda x: abs(x[1]))
            print(f"    Top SHAP feature: {top_feature[0]} = {top_feature[1]:.4f}")

    return results


# ── 5. Feature importance comparison ─────────────────────────────────────

def run_feature_importance_analysis(X, y):
    print("\n" + "=" * 70)
    print("PHASE 5: Feature Importance Analysis")
    print("=" * 70)

    x_train, x_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )

    model = LocationAwareFloodXGBoostModel()
    model._estimator = model._build_estimator()
    model._fit(model._estimator, x_train, y_train)

    importance = model._extract_feature_importance(model._estimator)
    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)

    print("\n  XGBoost Feature Importance:")
    for feat, imp in sorted_imp:
        bar = "#" * int(imp * 50)
        print(f"    {feat:30s}: {imp:.4f} {bar}")

    return importance


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Comprehensive model training and validation")
    parser.add_argument("--skip-cv", action="store_true", help="Skip cross-validation")
    parser.add_argument("--ablation-only", action="store_true", help="Run only ablation study")
    args = parser.parse_args()

    print("Loading dataset...")
    base_X, ext_X, y, raw_data = load_data()
    print(f"  Dataset: {len(raw_data)} records, {len(EXTENDED_FEATURES)} features")
    print(f"  Target distribution: {y.value_counts().to_dict()}")

    all_results = {}

    if not args.ablation_only:
        all_results["training"] = train_all_models(ext_X, y)

        if not args.skip_cv:
            all_results["cross_validation"] = run_cross_validation(ext_X, y)

        all_results["scenarios"] = run_scenario_tests()
        all_results["feature_importance"] = run_feature_importance_analysis(ext_X, y)

    all_results["ablation"] = run_ablation_study(ext_X, y)

    # Save comprehensive results
    output_path = OUTPUT_DIR / "comprehensive_validation_report.json"
    with open(output_path, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\n\nResults saved to: {output_path}")

    print("\n" + "=" * 70)
    print("TRAINING AND VALIDATION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
