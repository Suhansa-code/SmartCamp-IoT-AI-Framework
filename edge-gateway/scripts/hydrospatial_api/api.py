from fastapi import APIRouter, Query, HTTPException
from .service import find_nearest_river_and_station, build_live_payload, build_live_prediction, build_hydrospatial_analysis
from .providers.weather_forecast_location import fetch_forecast_location
from digital_elevation_model.elevation_service import get_elevation


router = APIRouter()


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
    if error and result is None:
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
