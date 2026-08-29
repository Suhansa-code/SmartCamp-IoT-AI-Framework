import sys
from pathlib import Path
from typing import Dict, Optional

import numpy as np
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from base_model import BaseFloodModel, FloodPrediction, MODEL_FEATURES, MODELS_DIR, DATASET_PATH  # noqa: E402


MODEL_SAVE_PATH = MODELS_DIR / "xgboost_model.pkl"


class LocationAwareFloodXGBoostModel(BaseFloodModel):
    def __init__(self):
        super().__init__(model_name="xgboost_model", source="xgboost_extended_v2")

    def _build_estimator(self):
        return XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        )

    def _fit(self, estimator, x_train, y_train):
        positives = int((y_train == 1).sum())
        negatives = int((y_train == 0).sum())
        estimator.set_params(scale_pos_weight=(negatives / positives) if positives > 0 else 1.0)
        estimator.fit(x_train, y_train)

    def _extract_feature_importance(self, estimator) -> Optional[Dict[str, float]]:
        return {
            feature: float(importance)
            for feature, importance in zip(MODEL_FEATURES, estimator.feature_importances_)
        }


if __name__ == "__main__":
    model = LocationAwareFloodXGBoostModel()

    print("Training with extended feature set (8 features)...")
    metrics = model.train()
    print(f"\nTraining Complete")
    print(f"   AUC Score: {round(metrics['roc_auc'], 4)}")
    print(f"   Features: {metrics.get('features_used', MODEL_FEATURES)}")
    print(f"   Charts saved to: {metrics['charts_output_dir']}")
    print(f"   Model saved to: {MODEL_SAVE_PATH}")

    # Cross-validation
    print("\nRunning 5-fold stratified cross-validation...")
    cv_results = model.cross_validate(n_folds=5)
    agg = cv_results["aggregated"]
    print(f"   ROC-AUC: {agg['roc_auc']['mean']:.4f} ± {agg['roc_auc']['std']:.4f}")
    print(f"   Accuracy: {agg['accuracy']['mean']:.4f} ± {agg['accuracy']['std']:.4f}")
    print(f"   Precision: {agg['precision']['mean']:.4f} ± {agg['precision']['std']:.4f}")
    print(f"   Recall: {agg['recall']['mean']:.4f} ± {agg['recall']['std']:.4f}")
    print(f"   F1: {agg['f1']['mean']:.4f} ± {agg['f1']['std']:.4f}")

    # Sample prediction with SHAP
    sample = model.predict_one(
        rainfall_mm=160.0, longitude=80.945, latitude=7.507,
        altitude_m=88.0, dem_elevation_m=81.0, nearest_river_m=350.0,
        water_level_m=2.3, is_forecast=True,
        gauge_alert_level=4.5, gauge_minor_level=5.5, gauge_major_level=7.0,
        return_shap=True,
    )
    print(f"\nSample prediction: {sample}")
