"""
dht11_api.py — FastAPI router exposing GET /api/dht11.

Returns temperature and relative humidity from the DHT11 sensor.
Reads from the shared in-memory cache maintained by sensor_state.py.
The serial port is never opened here — only the background reader owns COM5.
"""
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from sensor_state import dht11_state

router = APIRouter()


@router.get("/dht11")
def get_dht11():
    """
    Return current DHT11 temperature and relative humidity from cached sensor state.

    On success  → sensor_status=ACTIVE
    On failure  → sensor_status=ERROR
    """
    now = datetime.now(timezone.utc).isoformat()
    snapshot = dht11_state.get_status()
    last = snapshot["last_value"]

    if snapshot["connected"] and last:
        return {
            "temperature": last["temperature"],
            "relative_humidity": last["relative_humidity"],
            "sensor_status": "ACTIVE",
            "source": "DHT11_SENSOR",
            "timestamp": now,
        }

    return JSONResponse(
        status_code=503,
        content={
            "temperature": None,
            "relative_humidity": None,
            "sensor_status": "ERROR",
            "source": "DHT11_SENSOR",
            "error": "No data from DHT11 sensor",
            "timestamp": now,
        },
    )
