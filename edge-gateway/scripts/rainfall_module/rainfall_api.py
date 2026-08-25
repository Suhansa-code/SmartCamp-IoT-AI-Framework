"""
rainfall_api.py — FastAPI router exposing GET /api/rainfall.

Returns rain sensor data from the YL-83/FC-37 rainfall sensor.
Reads from the shared in-memory cache maintained by sensor_state.py.
The serial port is never opened here — only the background reader owns COM5.
"""
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from sensor_state import rain_state

router = APIRouter()


@router.get("/rainfall")
def get_rainfall():
    """
    Return current rainfall sensor data from cached sensor state.

    On success  → sensor_status=ACTIVE
    On failure  → sensor_status=ERROR
    """
    now = datetime.now(timezone.utc).isoformat()
    snapshot = rain_state.get_status()
    last = snapshot["last_value"]

    if snapshot["connected"] and last:
        return {
            "rain_analog": last["rain_analog"],
            "rain_digital": last["rain_digital"],
            "rain_status": last["rain_status"],
            "wetness_level": last["wetness_level"],
            "sensor_status": "ACTIVE",
            "source": "RAIN_SENSOR",
            "timestamp": now,
        }

    return JSONResponse(
        status_code=503,
        content={
            "rain_analog": None,
            "rain_digital": None,
            "rain_status": None,
            "wetness_level": None,
            "sensor_status": "ERROR",
            "source": "RAIN_SENSOR",
            "error": "No data from rainfall sensor",
            "timestamp": now,
        },
    )
