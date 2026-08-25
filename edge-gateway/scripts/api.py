"""
api.py — FastAPI application for the Edge Gateway.

Starts the persistent ESP32 background reader on import.
Registers shutdown hook to cleanly release the serial port.
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from hydrospatial_api.api import router as hydro_router
from gps_module.gps_api import router as gps_router
from dht11_module.dht11_api import router as dht11_router
from sensor_state import gps_state, dht11_state, start_background_readers, stop_background_readers


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: start background reader. Shutdown: cleanly release serial port."""
    start_background_readers()
    yield
    stop_background_readers()


app = FastAPI(title="Edge Gateway API", lifespan=lifespan)

app.include_router(hydro_router, prefix="/hydrospatial")
app.include_router(gps_router, prefix="/api")
app.include_router(dht11_router, prefix="/api")


@app.get("/")
def root():
    return {"status": "running"}


@app.get("/api/device-status")
def get_device_status():
    """
    Aggregated device status with independent per-sensor connectivity.
    Returns cached sensor values (instant) — never blocks on serial I/O.
    """
    now = datetime.now(timezone.utc).isoformat()

    # ── GPS (from background cache) ────────────────────────────
    gps_snapshot = gps_state.get_status()
    gps_last = gps_snapshot["last_value"]

    if gps_snapshot["connected"] and gps_last:
        gps_sensor = {
            "connected": True,
            "status": "active",
            "latitude": gps_last["latitude"],
            "longitude": gps_last["longitude"],
            "altitude": gps_last.get("altitude", 0),
            "satellites": gps_last.get("satellites", 0),
            "location_name": gps_last.get("location_name", ""),
            "is_mock": False,
            "source": "GPS_SENSOR",
            "timestamp": now,
        }
    else:
        gps_sensor = {
            "connected": False,
            "status": "disconnected",
            "latitude": None,
            "longitude": None,
            "altitude": None,
            "satellites": 0,
            "location_name": None,
            "is_mock": False,
            "source": "UNAVAILABLE",
            "timestamp": now,
        }

    # ── DHT11 (from background cache) ──────────────────────────
    dht_snapshot = dht11_state.get_status()
    dht_connected = dht_snapshot["connected"]
    dht_last = dht_snapshot["last_value"]

    if dht_connected and dht_last:
        temp_sensor = {
            "connected": True,
            "status": "active",
            "value": dht_last["temperature"],
            "unit": "C",
            "timestamp": now,
        }
        hum_sensor = {
            "connected": True,
            "status": "active",
            "value": dht_last["relative_humidity"],
            "unit": "%",
            "timestamp": now,
        }
    else:
        temp_sensor = {
            "connected": False,
            "status": "disconnected",
            "value": None,
            "unit": "C",
            "error": "No data from DHT11 sensor",
            "timestamp": now,
        }
        hum_sensor = {
            "connected": False,
            "status": "disconnected",
            "value": None,
            "unit": "%",
            "error": "No data from DHT11 sensor",
            "timestamp": now,
        }

    return {
        "device": {
            "id": "edge-gateway",
            "status": "connected",
            "uptime_note": "Gateway is responding",
        },
        "sensors": {
            "gps": gps_sensor,
            "temperature": temp_sensor,
            "humidity": hum_sensor,
        },
        "timestamp": now,
    }
