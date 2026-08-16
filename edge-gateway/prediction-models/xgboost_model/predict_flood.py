import io
import json
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import joblib

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from xgboost_model import LocationAwareFloodXGBoostModel, MODEL_SAVE_PATH


def load_model() -> LocationAwareFloodXGBoostModel:
    model = LocationAwareFloodXGBoostModel()

    if MODEL_SAVE_PATH.exists():
        model._estimator = joblib.load(MODEL_SAVE_PATH)
        model._is_trained = True
        return model

    buffer = io.StringIO()
    with redirect_stdout(buffer), redirect_stderr(buffer):
        model.train()
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
        gauging_station_current_water_level_m=to_float(payload, 'gauging_station_current_water_level_m'),
        is_forecast=bool(payload.get('is_forecast', True)),
    )

    print(
        json.dumps(
            {
                'flood_possibility': prediction.flood_possibility,
                'category': prediction.category,
                'future_forecast': prediction.future_forecast,
                'probability': prediction.probability,
                'source': prediction.source,
                'input': payload,
            }
        )
    )


if __name__ == '__main__':
    main()
