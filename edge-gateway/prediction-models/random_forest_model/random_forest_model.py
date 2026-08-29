import sys
from pathlib import Path
from typing import Dict, Optional

from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from base_model import BaseFloodModel, MODEL_FEATURES, MODELS_DIR  # noqa: E402


MODEL_SAVE_PATH = MODELS_DIR / "random_forest_model.pkl"


class LocationAwareFloodRandomForestModel(BaseFloodModel):
    def __init__(self):
        super().__init__(model_name="random_forest_model", source="random_forest_baseline_v1")

    def _build_estimator(self):
        return Pipeline([
            ("scaler", StandardScaler()),
            ("model", RandomForestClassifier(
                n_estimators=300, max_depth=12, min_samples_leaf=20,
                class_weight="balanced_subsample", random_state=42, n_jobs=-1,
            )),
        ])

    def _extract_feature_importance(self, estimator) -> Optional[Dict[str, float]]:
        return {
            feature: float(importance)
            for feature, importance in zip(
                MODEL_FEATURES, estimator.named_steps["model"].feature_importances_
            )
        }


if __name__ == "__main__":
    model = LocationAwareFloodRandomForestModel()
    metrics = model.train()
    print(f"\nTraining Complete")
    print(f"   AUC Score: {round(metrics['roc_auc'], 4)}")
    print(f"   Charts saved to: {metrics['charts_output_dir']}")
    print(f"   Model saved to: {MODEL_SAVE_PATH}")

    sample = model.predict_one(
        rainfall_mm=160.0, longitude=80.945, latitude=7.507,
        altitude_m=88.0, dem_elevation_m=81.0, nearest_river_m=350.0,
        water_level_m=2.3, is_forecast=True,
        gauge_alert_level=4.5, gauge_minor_level=5.5, gauge_major_level=7.0,
    )
    print(sample)
