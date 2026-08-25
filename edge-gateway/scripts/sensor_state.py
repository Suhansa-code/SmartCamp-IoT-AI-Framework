"""
sensor_state.py — Persistent ESP32 serial reader with per-sensor connectivity tracking.

Opens the ESP32 serial port ONCE at startup and maintains a single background
reader thread. The reader continuously parses both GPS NMEA sentences and DHT11
readings from the same USB serial connection.

All API endpoints read from in-memory cache — /api/device-status, /api/gps, and
/api/dht11 never touch the serial port directly.

Reconnection: if the serial port drops, the reader retries with exponential
backoff without spawning duplicate threads.
"""
import os
import re
import time
import threading
from datetime import datetime, timezone

import serial
import pynmea2

# ── Configuration ───────────────────────────────────────────────────────────

SERIAL_PORT = os.environ.get("GPS_PORT", "COM5")
SERIAL_BAUD = int(os.environ.get("GPS_BAUDRATE", "115200"))

# How many consecutive read failures before marking disconnected
CONSECUTIVE_FAILURES = 3

# How many seconds of no successful read before considering stale
STALE_SECONDS = 30

# How often the background reader attempts a read (seconds)
POLL_INTERVAL = 3

# Reconnection backoff
RECONNECT_MIN_DELAY = 1.0
RECONNECT_MAX_DELAY = 30.0

# Lines to read per batch from the serial port
LINES_PER_BATCH = 30

# Reverse-geocode cache to avoid hammering Nominatim
_reverse_geo_cache: dict[tuple[float, float], str] = {}
_reverse_geo_lock = threading.Lock()


# ── Reverse geocoding ───────────────────────────────────────────────────────

def _reverse_geocode(lat: float, lng: float) -> str | None:
    """Return a human-readable location name, or None on failure.
    Caches results by (lat, lng) rounded to 4 decimals."""
    import requests

    key = (round(lat, 4), round(lng, 4))
    with _reverse_geo_lock:
        if key in _reverse_geo_cache:
            return _reverse_geo_cache[key]

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
        name = ", ".join(p for p in parts if p) or data.get("display_name") or f"{lat}, {lng}"
    except Exception:
        name = None

    with _reverse_geo_lock:
        _reverse_geo_cache[key] = name

    return name


# ── Sensor state tracker ────────────────────────────────────────────────────

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


# ── Singleton sensor states (importable across modules) ────────────────────

gps_state = SensorState("gps")
dht11_state = SensorState("dht11")

# ── DHT11 parsing ──────────────────────────────────────────────────────────

_TEMP_HUM_RE = re.compile(r'TEMP:([0-9.]+)\|HUM:([0-9.]+)')


def _parse_dht11_line(line: str) -> dict | None:
    """Parse a DHT11 line like TEMP:29.40|HUM:68.00."""
    m = _TEMP_HUM_RE.search(line)
    if m:
        return {
            "temperature": float(m.group(1)),
            "relative_humidity": float(m.group(2)),
        }
    return None


# ── Persistent serial reader ───────────────────────────────────────────────

_stop = threading.Event()
_reader_thread: threading.Thread | None = None
_serial_lock = threading.Lock()


def _open_serial() -> serial.Serial | None:
    """Attempt to open the serial port. Returns None on failure."""
    try:
        return serial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
    except Exception as e:
        print("[ESP32] Cannot open %s: %s" % (SERIAL_PORT, e))
        return None


def _background_loop():
    """Single background thread: holds serial connection, reads GPS + DHT11 continuously."""
    ser: serial.Serial | None = None
    backoff = RECONNECT_MIN_DELAY

    while not _stop.is_set():
        # ── Ensure serial connection is open ───────────────────────────
        if ser is None or not ser.is_open:
            if ser is not None:
                try:
                    ser.close()
                except Exception:
                    pass
                ser = None

            ser = _open_serial()
            if ser is None:
                # Backoff before retrying
                gps_state.record_failure()
                dht11_state.record_failure()
                _stop.wait(min(backoff, RECONNECT_MAX_DELAY))
                backoff = min(backoff * 2, RECONNECT_MAX_DELAY)
                continue

            # Connection succeeded — reset backoff
            backoff = RECONNECT_MIN_DELAY
            print("[ESP32] Serial connection opened: %s @ %d" % (SERIAL_PORT, SERIAL_BAUD))

        # ── Read a batch of lines from the persistent connection ──────
        gps_data = None
        dht11_data = None
        _debug_lines = []

        try:
            for _ in range(LINES_PER_BATCH):
                raw = ser.readline()
                if not raw:
                    continue

                line = raw.decode('ascii', errors='ignore').strip()
                if not line:
                    continue

                # if len(_debug_lines) < 5:
                #     _debug_lines.append(line)

                # GPS: NMEA sentence ($GPGGA, $GNGGA, $GNRMC, etc.)
                if line.startswith('$GPGGA') or line.startswith('$GNGGA'):
                    try:
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

                # DHT11: TEMP:29.40|HUM:68.00
                dht11_data = _parse_dht11_line(line) or dht11_data

            if _debug_lines:
                print("[ESP32] Raw lines: %s" % _debug_lines)

        except serial.SerialException as e:
            print("[ESP32] Serial error, will reconnect: %s" % e)
            try:
                ser.close()
            except Exception:
                pass
            ser = None
            gps_state.record_failure()
            dht11_state.record_failure()
            _stop.wait(POLL_INTERVAL)
            continue
        except Exception as e:
            print("[ESP32] Unexpected error: %s" % e)
            gps_state.record_failure()
            dht11_state.record_failure()
            _stop.wait(POLL_INTERVAL)
            continue

        # ── Update sensor states ────────────────────────────────────────
        if gps_data:
            gps_state.record_success(gps_data)
        else:
            gps_state.record_failure()

        if dht11_data:
            dht11_state.record_success(dht11_data)
        else:
            dht11_state.record_failure()

        _stop.wait(POLL_INTERVAL)

    # ── Clean shutdown ──────────────────────────────────────────────────
    if ser is not None and ser.is_open:
        try:
            ser.close()
            print("[ESP32] Serial connection closed")
        except Exception:
            pass


def start_background_readers():
    """Start the persistent ESP32 background reader. Called once at app startup."""
    global _reader_thread
    if _reader_thread and _reader_thread.is_alive():
        return
    _stop.clear()
    _reader_thread = threading.Thread(target=_background_loop, daemon=True, name="sensor-esp32")
    _reader_thread.start()
    print("[ESP32] Background reader started")


def stop_background_readers():
    """Signal the background reader to stop and wait for clean shutdown."""
    _stop.set()
    if _reader_thread and _reader_thread.is_alive():
        _reader_thread.join(timeout=5)
    print("[ESP32] Background reader stopped")


def get_gps_data() -> dict | None:
    """Return the latest cached GPS data, or None if unavailable."""
    status = gps_state.get_status()
    if status["connected"] and status["last_value"]:
        return status["last_value"]
    return None


def get_dht11_data() -> dict | None:
    """Return the latest cached DHT11 data, or None if unavailable."""
    status = dht11_state.get_status()
    if status["connected"] and status["last_value"]:
        return status["last_value"]
    return None
