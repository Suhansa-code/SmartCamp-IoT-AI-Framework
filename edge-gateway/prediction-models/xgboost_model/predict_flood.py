import json
import sys
from pathlib import Path

import joblib

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from xgboost_model import LocationAwareFloodXGBoostModel
from base_model import IMPROVED_MODEL_PATH


def load_model() -> LocationAwareFloodXGBoostModel:
    """Load the production model artifact (models/xgboost_model_improved.pkl).

    This is the only model in the serving path — trained on the real DMC gauge
    dataset by train_real_flood.py. Raises if the artifact is missing; there is
    no legacy retrain fallback anymore.
    """
    if not IMPROVED_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Production model artifact missing: {IMPROVED_MODEL_PATH}. "
            "Run train_real_flood.py to (re)train it."
        )
    artifact = joblib.load(IMPROVED_MODEL_PATH)
    model = LocationAwareFloodXGBoostModel()
    model._estimator = artifact["estimator"]
    model._is_trained = True
    return model


def to_float(payload, key, fallback=0.0):
    try:
        return float(payload.get(key, fallback))
    except (TypeError, ValueError):
        return float(fallback)


def main() -> None:
    raw_input = sys.stdin.read().strip() or '{}'
    payload = json.loads(raw_input)

    model = load_model()
    prediction = model.predict_one(
        rainfall_mm=to_float(payload, 'rainfall_mm'),
        longitude=to_float(payload, 'longitude'),
        latitude=to_float(payload, 'latitude'),
        altitude_m=to_float(payload, 'altitude_m'),
        dem_elevation_m=None if payload.get('dem_elevation_m') is None else to_float(payload, 'dem_elevation_m'),
        nearest_river_m=to_float(payload, 'nearest_river_m'),
        water_level_m=to_float(payload, 'water_level_m'),
        monthly_rainfall_mm=to_float(payload, 'monthly_rainfall_mm'),
        drainage_index=to_float(payload, 'drainage_index', 0.5),
        is_forecast=bool(payload.get('is_forecast', True)),
        gauge_alert_level=to_float(payload, 'gauge_alert_level', 2.0),
        gauge_minor_level=to_float(payload, 'gauge_minor_level', 3.0),
        gauge_major_level=to_float(payload, 'gauge_major_level', 5.0),
        return_shap=bool(payload.get('return_shap', False)),
    )

    print(
        json.dumps(
            {
                'flood_possibility': prediction.flood_possibility,
                'category': prediction.category,
                'future_forecast': prediction.future_forecast,
                'probability': prediction.probability,
                'source': prediction.source,
                'roc_auc': model.metrics_.get('roc_auc') if model._is_trained else None,
                'shap_values': prediction.shap_values,
                'features_used': model.metrics_.get('features_used', []),
                'input': payload,
            }
        )
    )


if __name__ == '__main__':
    main()
