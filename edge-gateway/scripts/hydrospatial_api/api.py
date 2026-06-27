from fastapi import APIRouter, Query, HTTPException
from .service import find_nearest_river_and_station


router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


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
