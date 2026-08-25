"""
gps_api.py — FastAPI router exposing GET /api/gps.

Single source of GPS truth for the Raspberry Pi platform.
Reads from the shared in-memory cache maintained by sensor_state.py.
The serial port is never opened here — only the background reader owns COM5.
"""
from datetime import datetime, timezone

from fastapi import APIRouter

from sensor_state import gps_state

router = APIRouter()


# ── Endpoint ────────────────────────────────────────────────────────────

@router.get("/gps")
def get_gps():
    """
    Return current GPS location from cached sensor state.

    Real GPS  → gps_status=ACTIVE,  is_mock=false, source=GPS_SENSOR
    No GPS    → gps_status=UNAVAILABLE, is_mock=false, source=UNAVAILABLE
    """
    now = datetime.now(timezone.utc).isoformat()
    snapshot = gps_state.get_status()
    last = snapshot["last_value"]

    if snapshot["connected"] and last:
        return {
            "latitude": last["latitude"],
            "longitude": last["longitude"],
            "altitude": last.get("altitude", 0),
            "satellites": last.get("satellites", 0),
            "location_name": last.get("location_name", ""),
            "gps_status": "ACTIVE",
            "is_mock": False,
            "source": "GPS_SENSOR",
            "timestamp": now,
        }

    return {
        "latitude": None,
        "longitude": None,
        "altitude": None,
        "satellites": 0,
        "location_name": None,
        "gps_status": "UNAVAILABLE",
        "is_mock": False,
        "source": "UNAVAILABLE",
        "timestamp": now,
    }
