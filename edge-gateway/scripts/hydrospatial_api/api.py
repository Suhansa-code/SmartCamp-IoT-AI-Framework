from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from .service import find_nearest_river_and_station, build_live_payload, build_live_prediction, build_hydrospatial_analysis, build_local_prediction
from .providers.weather_forecast_location import fetch_forecast_location
from .providers.live_water_level_api import get_gauge_history
from digital_elevation_model.elevation_service import get_elevation


router = APIRouter()


class PredictLocalRequest(BaseModel):
    rainfall_mm: float = 0.0
    longitude: float = 0.0
    latitude: float = 0.0
    altitude_m: float = 10.0
    dem_elevation_m: Optional[float] = None
    nearest_river_m: float = 0.0
    water_level_m: float = 0.0
    is_forecast: bool = True
    gauge_alert_level: float = 2.0
    gauge_minor_level: float = 3.0
    gauge_major_level: float = 5.0
    return_shap: bool = True


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/elevation")
def elevation(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
):
    """Get DEM elevation for a coordinate. Uses local raster, falls back to Open-Elevation API."""
    result = get_elevation(lat, lon, use_api_fallback=True)
    if result.get("elevation_m") is None:
        raise HTTPException(status_code=502, detail={"error": result.get("error"), "source": result.get("source")})
    return result


@router.get("/predict")
def predict(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    alt: float = Query(10.0, description="Altitude"),
):
    """Run live flood prediction with current gauge data."""
    result, error = build_live_prediction(lat, lon, alt)
    if error and (result is None or result.get("prediction") is None):
        raise HTTPException(status_code=502, detail=error)
    return result


@router.post("/predict-local")
def predict_local(body: PredictLocalRequest):
    """Run flood prediction with pre-assembled feature vector (no external API fetches).

    Accepts the complete model input payload directly and runs XGBoost inference
    without querying ArcGIS, Overpass, or DEM services. Used for simulation mode.
    """
    inputs = body.model_dump()
    if inputs["dem_elevation_m"] is None:
        inputs["dem_elevation_m"] = inputs["altitude_m"]

    result, error = build_local_prediction(inputs)
    if error and (result is None or result.get("prediction") is None):
        raise HTTPException(status_code=502, detail=error)
    return result


@router.get("/live-payload")
def live_payload(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    alt: float = Query(10.0, description="Altitude"),
):
    """Full live payload: river, gauging station (CSV), live gauge data (ArcGIS), forecast."""
    result = build_live_payload(lat, lon, alt)
    return result


@router.get("/weather")
def weather(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
):
    """Weather forecast for a given location via Open-Meteo."""
    result, error = fetch_forecast_location(lat, lon)
    if error:
        raise HTTPException(status_code=502, detail=error)
    return result


@router.get("/nearest-river-gauging-station")
def nearest_river_gauging_station(lat: float = Query(..., description="Latitude"),lon: float = Query(..., description="Longitude"),):

    result, error = find_nearest_river_and_station(lat, lon)
    
    if error:
            raise HTTPException(status_code=502, detail=error)
    
    if result["gauging_station"] is None:
        return {
            "river": result["river"],
            "message": "No nearby water-level gauging station found near the nearest river.",
        }
    return result


@router.get("/water-level-history")
def water_level_history(
    station: str = Query(..., description="Gauging station name"),
    hours: int = Query(24, ge=1, le=168, description="Hours of history to fetch"),
):
    """Query ArcGIS for historical water level readings of a gauging station."""
    try:
        readings = get_gauge_history(station, hours)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ArcGIS query failed: {e}")
    return {
        "station": station,
        "hours": hours,
        "count": len(readings),
        "readings": readings,
    }


@router.get("/analysis")
def hydrospatial_analysis(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    alt: float = Query(10.0, description="Altitude"),
):
    """Complete hydro-spatial analysis: DEM elevation, river, station, gauge, spatial relationships."""
    result = build_hydrospatial_analysis(lat, lon, alt)
    return result



if __name__ == "__main__":
    router.run(host="0.0.0.0", port=5000, debug=True)
