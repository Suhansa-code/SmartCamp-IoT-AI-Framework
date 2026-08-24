from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from hydrospatial_api.api import router as hydro_router
from gps_module.gps_api import router as gps_router, _read_gps_with_timeout, _reverse_geocode, MOCK_LAT, MOCK_LNG, MOCK_NAME
from dht11_module.dht11_api import router as dht11_router, _read_dht11_with_timeout
from sensor_state import gps_state, dht11_state

app = FastAPI(title="Edge Gateway API")

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
    Called by the Raspberry Platform backend to power the Devices page.

    Each sensor is tracked independently:
      - GPS connected = physical GPS sensor is providing valid NMEA data
      - DHT11 connected = ESP32/USB is providing valid temperature+humidity
      - Gateway connected = this API is responding (implied by the request itself)
    """
    now = datetime.now(timezone.utc).isoformat()

    # ── GPS ────────────────────────────────────────────────────
    gps_data = _read_gps_with_timeout()
    if gps_data and gps_data.get("latitude") is not None:
        lat = gps_data["latitude"]
        lng = gps_data["longitude"]
        loc = _reverse_geocode(lat, lng) or f"{lat}, {lng}"
        gps_state.record_success({
            "latitude": lat,
            "longitude": lng,
            "altitude": gps_data.get("altitude", 0),
            "satellites": gps_data.get("satellites", 0),
            "location_name": loc,
        })
    else:
        gps_state.record_failure()

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
        # Sensor disconnected — use mock values as fallback reference
        loc = _reverse_geocode(MOCK_LAT, MOCK_LNG) or MOCK_NAME
        gps_sensor = {
            "connected": False,
            "status": "disconnected",
            "latitude": MOCK_LAT,
            "longitude": MOCK_LNG,
            "altitude": 0,
            "satellites": 0,
            "location_name": loc,
            "is_mock": True,
            "source": "MOCK_LOCATION",
            "timestamp": now,
        }

    # ── DHT11 (temperature + humidity) ─────────────────────────
    dht_data, dht_err = _read_dht11_with_timeout()
    if dht_data:
        dht11_state.record_success({
            "temperature": dht_data["temperature"],
            "relative_humidity": dht_data["relative_humidity"],
        })
    else:
        dht11_state.record_failure()

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
        err_msg = dht_err or "No data from DHT11 sensor"
        temp_sensor = {
            "connected": False,
            "status": "disconnected",
            "value": None,
            "unit": "C",
            "error": err_msg,
            "timestamp": now,
        }
        hum_sensor = {
            "connected": False,
            "status": "disconnected",
            "value": None,
            "unit": "%",
            "error": err_msg,
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
