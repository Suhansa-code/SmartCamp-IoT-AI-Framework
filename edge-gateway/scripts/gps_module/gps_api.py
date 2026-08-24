"""
gps_api.py — FastAPI router exposing GET /api/gps.

Single source of GPS truth for the Raspberry Pi platform.
- Tries the physical GPS sensor (GPSReader serial read, 10s timeout).
- On any failure, falls back to configured mock location (default: Colombo).
- Reverse geocodes real GPS coordinates via Nominatim for a human-readable location name.
"""
import os
import time
import threading
from datetime import datetime, timezone

import requests
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .gps_reader import GPSReader

router = APIRouter()

# ── Mock / fallback configuration (env vars, default: Colombo) ──────────

MOCK_LAT = float(os.environ.get("GPS_MOCK_LATITUDE", "6.9271"))
MOCK_LNG = float(os.environ.get("GPS_MOCK_LONGITUDE", "79.8612"))
MOCK_NAME = os.environ.get("GPS_MOCK_LOCATION_NAME", "Colombo")

GPS_PORT = os.environ.get("GPS_PORT", "COM5")
GPS_BAUD = int(os.environ.get("GPS_BAUDRATE", "115200"))
GPS_TIMEOUT = 10


# ── Reverse geocoding via Nominatim ─────────────────────────────────────

def _reverse_geocode(lat: float, lng: float) -> str | None:
    """Return a human-readable location name, or None on failure."""
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"format": "json", "lat": lat, "lon": lng, "zoom": 18, "addressdetails": 1},
            headers={"Accept-Language": "en"},
            timeout=5,
        )
        data = resp.json()
        addr = data.get("address", {})
        parts = [
            addr.get("village") or addr.get("town") or addr.get("city") or addr.get("hamlet"),
            addr.get("district") or addr.get("county") or addr.get("state_district"),
        ]
        name = ", ".join(p for p in parts if p)
        return name or data.get("display_name") or f"{lat}, {lng}"
    except Exception:
        return None


# ── GPS read with timeout ───────────────────────────────────────────────

def _read_gps_with_timeout() -> dict | None:
    """Try to read from the serial GPS sensor. Returns None on failure."""
    result = [None]
    error = [None]

    def _target():
        try:
            reader = GPSReader(GPS_PORT, GPS_BAUD)
            data = reader.get_gps_data()
            if data and data.get("latitude") is not None and data.get("longitude") is not None:
                result[0] = data
        except Exception as e:
            error[0] = str(e)

    thread = threading.Thread(target=_target, daemon=True)
    thread.start()
    thread.join(timeout=GPS_TIMEOUT)

    if thread.is_alive():
        return None
    if error[0] is not None:
        return None
    return result[0]


# ── Endpoint ────────────────────────────────────────────────────────────

@router.get("/gps")
def get_gps():
    """
    Return current GPS location.

    Real GPS  → gps_status=ACTIVE,  is_mock=false, source=GPS_SENSOR
    Fallback  → gps_status=MOCK,    is_mock=true,  source=MOCK_LOCATION
    """
    gps_data = _read_gps_with_timeout()

    if gps_data:
        lat = gps_data["latitude"]
        lng = gps_data["longitude"]
        alt = gps_data.get("altitude", 0)
        sats = gps_data.get("satellites", 0)
        loc_name = _reverse_geocode(lat, lng) or f"{lat}, {lng}"
        return {
            "latitude": lat,
            "longitude": lng,
            "altitude": alt,
            "satellites": sats,
            "location_name": loc_name,
            "gps_status": "ACTIVE",
            "is_mock": False,
            "source": "GPS_SENSOR",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # GPS failed → return mock location
    loc_name = _reverse_geocode(MOCK_LAT, MOCK_LNG) or MOCK_NAME
    return {
        "latitude": MOCK_LAT,
        "longitude": MOCK_LNG,
        "altitude": 0,
        "satellites": 0,
        "location_name": loc_name,
        "gps_status": "MOCK",
        "is_mock": True,
        "source": "MOCK_LOCATION",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
