"""
sensor_state.py — Background sensor reader with per-sensor connectivity tracking.

Runs a single background thread that reads from the ESP32 serial port.
The ESP32 sends both GPS NMEA sentences and DHT11 readings over one USB serial connection.
The endpoint reads from cache (instant), never blocking on serial I/O.
A sensor is "connected" only after a successful read,
and "disconnected" after CONSECUTIVE_FAILURES threshold is exceeded.
"""
import re
import time
import threading
from datetime import datetime, timezone

# How many consecutive read failures before marking disconnected
CONSECUTIVE_FAILURES = 3

# How many seconds of no successful read before considering stale
STALE_SECONDS = 30

# How often the background reader attempts a read (seconds)
POLL_INTERVAL = 3


class SensorState:
    """Thread-safe per-sensor connectivity tracker."""

    def __init__(self, name: str):
        self.name = name
        self._lock = threading.Lock()
        self.connected = False
        self.consecutive_failures = 0
        self.last_success_at: float = 0.0
        self.last_value: dict | None = None

    def record_success(self, value: dict):
        with self._lock:
            self.connected = True
            self.consecutive_failures = 0
            self.last_success_at = time.time()
            self.last_value = value

    def record_failure(self):
        with self._lock:
            self.consecutive_failures += 1
            if self.consecutive_failures >= CONSECUTIVE_FAILURES:
                self.connected = False

    def get_status(self) -> dict:
        with self._lock:
            now = time.time()
            seconds_since = now - self.last_success_at if self.last_success_at > 0 else None

            if self.connected and seconds_since is not None and seconds_since > STALE_SECONDS:
                self.connected = False

            return {
                "connected": self.connected,
                "consecutive_failures": self.consecutive_failures,
                "seconds_since_last_read": round(seconds_since, 1) if seconds_since is not None else None,
                "last_value": self.last_value,
            }


# ── Unified ESP32 reader ───────────────────────────────────────────

_TEMP_HUM_RE = re.compile(r'TEMP:([0-9.]+)\|HUM:([0-9.]+)')


def _read_esp32_data():
    """Read from ESP32 serial port and parse both GPS and DHT11 data.

    Returns (gps_dict_or_None, dht11_dict_or_None).
    The ESP32 sends NMEA sentences for GPS and TEMP:XX|HUM:XX lines for DHT11,
    all over one USB serial connection at 115200 baud.
    """
    from gps_module.gps_api import GPS_PORT, GPS_BAUD, _reverse_geocode
    import serial

    try:
        ser = serial.Serial(GPS_PORT, GPS_BAUD, timeout=1)
    except Exception as e:
        print("[ESP32] Cannot open %s: %s" % (GPS_PORT, e))
        return None, None

    gps_data = None
    dht11_data = None
    _debug_lines = []

    try:
        for _ in range(30):
            line = ser.readline().decode('ascii', errors='ignore').strip()
            if not line:
                continue

            if len(_debug_lines) < 5:
                _debug_lines.append(line)

            # GPS: NMEA sentence
            if line.startswith('$GPGGA') or line.startswith('$GNGGA'):
                try:
                    import pynmea2
                    msg = pynmea2.parse(line)
                    if msg.latitude and msg.longitude:
                        loc = _reverse_geocode(msg.latitude, msg.longitude) or "%s, %s" % (msg.latitude, msg.longitude)
                        gps_data = {
                            "latitude": msg.latitude,
                            "longitude": msg.longitude,
                            "altitude": float(msg.altitude or 0),
                            "satellites": int(msg.num_sats or 0),
                            "location_name": loc,
                        }
                except Exception:
                    pass
                continue

            # DHT11: TEMP:28.80|HUM:87.80
            m = _TEMP_HUM_RE.search(line)
            if m:
                dht11_data = {
                    "temperature": float(m.group(1)),
                    "relative_humidity": float(m.group(2)),
                }

        if _debug_lines:
            print("[ESP32] Raw lines: %s" % _debug_lines)

    finally:
        try:
            ser.close()
        except Exception:
            pass

    return gps_data, dht11_data


# ── Singleton sensor states (importable across modules) ───────────────
gps_state = SensorState("gps")
dht11_state = SensorState("dht11")

_stop = threading.Event()
_reader_thread: threading.Thread | None = None


def _background_loop():
    """Single background thread: reads ESP32 serial, updates both sensor states."""
    while not _stop.is_set():
        try:
            gps_data, dht11_data = _read_esp32_data()

            if gps_data:
                gps_state.record_success(gps_data)
            else:
                gps_state.record_failure()

            if dht11_data:
                dht11_state.record_success(dht11_data)
            else:
                dht11_state.record_failure()

        except Exception as e:
            print("[ESP32] Background reader error: %s" % e)
            gps_state.record_failure()
            dht11_state.record_failure()

        _stop.wait(POLL_INTERVAL)


def start_background_readers():
    """Start the unified ESP32 background reader. Called once at app startup."""
    global _reader_thread
    if _reader_thread and _reader_thread.is_alive():
        return
    _reader_thread = threading.Thread(target=_background_loop, daemon=True, name="sensor-esp32")
    _reader_thread.start()


def stop_background_readers():
    """Signal the background reader to stop."""
    _stop.set()
