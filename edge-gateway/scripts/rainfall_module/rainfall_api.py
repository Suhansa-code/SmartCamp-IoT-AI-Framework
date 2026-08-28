"""
rainfall_api.py — FastAPI router exposing GET/POST /api/rainfall.

GET  /api/rainfall — Returns rain sensor data from cached sensor state.
POST /api/rainfall — Receives rainfall data from wireless ESP32.

Supports both serial (Sensor_Bridge) and wireless (Rainfall_Sensor) communication.
Reads from the shared in-memory cache maintained by sensor_state.py.
"""
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from sensor_state import rain_state, update_rain_state_wireless

router = APIRouter()


class RainfallData(BaseModel):
    """Schema for wireless ESP32 rainfall data."""
    device_id: str = Field(..., min_length=1, max_length=50)
    rain_analog: int = Field(..., ge=0, le=4095)
    rain_digital: int = Field(..., ge=0, le=1)
    rain_status: str = Field(..., min_length=1, max_length=50)
    flood_risk: str = Field(default="LOW", min_length=1, max_length=50)
    timestamp: str = Field(default=None)


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


@router.post("/rainfall")
def receive_rainfall(data: RainfallData):
    """
    Receive rainfall data from wireless ESP32.
    
    Updates the shared rain_state with data from the wireless sensor.
    Returns 200 on success, 400 on invalid data.
    """
    try:
        update_rain_state_wireless(data.model_dump())
        return {
            "status": "received",
            "device_id": data.device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "error": str(e),
            },
        )
