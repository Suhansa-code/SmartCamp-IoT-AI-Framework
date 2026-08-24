"""
dht11_api.py — FastAPI router exposing GET /api/dht11.

Reads temperature and relative humidity from a DHT11 sensor
connected to an ESP32 via USB serial.
"""
import os
import threading

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from dht11_module.dht11_reader import DHT11Reader

router = APIRouter()

DHT11_PORT = os.environ.get("DHT11_PORT", None)
DHT11_BAUD = int(os.environ.get("DHT11_BAUDRATE", "9600"))
DHT11_TIMEOUT = 10


def _read_dht11_with_timeout():
    """Try to read from the ESP32 serial DHT11 sensor. Returns None on failure.
    On timeout, closes the serial port to release it for the next attempt."""
    result = [None]
    error = [None]
    reader_ref = [None]

    def _target():
        try:
            reader = DHT11Reader(DHT11_PORT, DHT11_BAUD)
            reader_ref[0] = reader
            data = reader.get_dht11_data()
            if data is not None:
                result[0] = data
        except Exception as e:
            error[0] = str(e)

    thread = threading.Thread(target=_target, daemon=True)
    thread.start()
    thread.join(timeout=DHT11_TIMEOUT)

    if thread.is_alive():
        if reader_ref[0]:
            reader_ref[0].close()
        return None, "DHT11 read timed out"
    if error[0] is not None:
        return None, error[0]
    return result[0], None


@router.get("/dht11")
def get_dht11():
    """
    Return current DHT11 temperature and relative humidity.

    On success  → sensor_status=ACTIVE
    On failure  → sensor_status=ERROR
    """
    data, err = _read_dht11_with_timeout()

    if data:
        return {
            "temperature": data["temperature"],
            "relative_humidity": data["relative_humidity"],
            "sensor_status": "ACTIVE",
            "source": "DHT11_SENSOR",
        }

    return JSONResponse(
        status_code=503,
        content={
            "temperature": None,
            "relative_humidity": None,
            "sensor_status": "ERROR",
            "source": "DHT11_SENSOR",
            "error": err or "No data from DHT11 sensor",
        },
    )
