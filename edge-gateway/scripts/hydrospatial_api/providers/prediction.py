"""Live flood prediction using the trained XGBoost model."""
import sys
from pathlib import Path

# Locate prediction-models directory (edge-gateway/prediction-models)
SCRIPTS_DIR = Path(__file__).resolve().parents[2]  # edge-gateway/scripts
PREDICTION_MODELS_DIR = SCRIPTS_DIR.parent / "prediction-models"
sys.path.insert(0, str(PREDICTION_MODELS_DIR))

_model = None
_load_error = None
_MODEL_LOCK = False


def get_model():
    """Load the XGBoost model once and cache it.

    Raises RuntimeError with a clear message if the model package, dependency
    or saved artifact is unavailable — never crashes the API at import time.
    """
    global _model, _load_error, _MODEL_LOCK
    if _model is not None:
        return _model
    if _load_error is not None:
        raise RuntimeError(_load_error)
    if _MODEL_LOCK:
        raise RuntimeError("Model is already being loaded")
    _MODEL_LOCK = True
    try:
        try:
            from xgboost_model.predict_flood import load_model
        except Exception as exc:  # noqa: BLE001 - surface any import failure
            _load_error = f"Prediction model package unavailable: {exc}"
            raise RuntimeError(_load_error)

        try:
            _model = load_model()
        except Exception as exc:  # noqa: BLE001
            _load_error = f"Prediction model failed to load: {exc}"
            raise RuntimeError(_load_error)

        if not getattr(_model, "_is_trained", False):
            _load_error = "Prediction model is not trained; run training first."
            raise RuntimeError(_load_error)
        return _model
    finally:
        _MODEL_LOCK = False


def run_prediction(inputs):
    """Run a live flood prediction.

    inputs keys: rainfall_mm, longitude, latitude, altitude_m, dem_elevation_m,
                 nearest_river_m, water_level_m, is_forecast,
                 gauge_alert_level, gauge_minor_level, gauge_major_level,
                 return_shap
    """
    model = get_model()

    prediction = model.predict_one(
        rainfall_mm=float(inputs.get("rainfall_mm", 0.0)),
        longitude=float(inputs.get("longitude", 0.0)),
        latitude=float(inputs.get("latitude", 0.0)),
        altitude_m=float(inputs.get("altitude_m", 0.0)),
        dem_elevation_m=None if inputs.get("dem_elevation_m") is None else float(inputs["dem_elevation_m"]),
        nearest_river_m=float(inputs.get("nearest_river_m", 0.0)),
        water_level_m=float(inputs.get("water_level_m", 0.0)),
        monthly_rainfall_mm=float(inputs.get("monthly_rainfall_mm", 0.0)),
        drainage_index=float(inputs.get("drainage_index", 0.5)),
        is_forecast=bool(inputs.get("is_forecast", True)),
        gauge_alert_level=float(inputs.get("gauge_alert_level", 2.0)),
        gauge_minor_level=float(inputs.get("gauge_minor_level", 3.0)),
        gauge_major_level=float(inputs.get("gauge_major_level", 5.0)),
        return_shap=bool(inputs.get("return_shap", False)),
    )

    return {
        "flood_possibility": prediction.flood_possibility,
        "category": prediction.category,
        "future_forecast": prediction.future_forecast,
        "probability": prediction.probability,
        "source": prediction.source,
        "shap_values": prediction.shap_values,
        "input": inputs,
    }
