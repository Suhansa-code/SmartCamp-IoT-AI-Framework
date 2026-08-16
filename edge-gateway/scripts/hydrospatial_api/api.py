from fastapi import APIRouter, Query, HTTPException
from .service import find_nearest_river_and_station, build_live_payload, build_live_prediction


router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


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



if __name__ == "__main__":
    router.run(host="0.0.0.0", port=5000, debug=True)
