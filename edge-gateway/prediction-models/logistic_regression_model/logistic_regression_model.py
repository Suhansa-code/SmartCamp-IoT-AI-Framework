import sys
from pathlib import Path

from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from base_model import BaseFloodModel, MODELS_DIR  # noqa: E402


MODEL_SAVE_PATH = MODELS_DIR / "logistic_regression_model.pkl"


class LocationAwareFloodLogisticModel(BaseFloodModel):
    def __init__(self):
        super().__init__(model_name="logistic_regression_model", source="logistic_regression_baseline_v1")

    def _build_estimator(self):
        return Pipeline([
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)),
        ])


if __name__ == "__main__":
    model = LocationAwareFloodLogisticModel()
    metrics = model.train()
    print(f"\nTraining Complete")
    print(f"   AUC Score: {round(metrics['roc_auc'], 4)}")
    print(f"   Charts saved to: {metrics['charts_output_dir']}")
    print(f"   Model saved to: {MODEL_SAVE_PATH}")

    print(f"\nSample Prediction:")
    sample = model.predict_one(
        rainfall_mm=160.0, longitude=80.945, latitude=7.507,
        altitude_m=88.0, dem_elevation_m=81.0, nearest_river_m=350.0,
        gauging_station_current_water_level_m=2.3, is_forecast=True,
    )
    print(f"   Flood Possibility: {sample.flood_possibility}")
    print(f"   Risk Category: {sample.category}")
    print(f"   Probability: {sample.probability:.3f}")
    print(f"   Forecast Probability: {sample.future_forecast['probability']:.3f}")
