"""
sensor_state.py — Background sensor reader with per-sensor connectivity tracking.

Runs continuous background threads for GPS and DHT11.
The endpoint reads from cache (instant), never blocking on serial I/O.
A sensor is "connected" only after a successful read,
and "disconnected" after CONSECUTIVE_FAILURES threshold is exceeded.
"""
import time
import threading
from datetime import datetime, timezone

# How many consecutive read failures before marking disconnected
CONSECUTIVE_FAILURES = 3

# How many seconds of no successful read before considering stale
STALE_SECONDS = 30

# How often each background reader attempts a read (seconds)
GPS_POLL_INTERVAL = 3
DHT11_POLL_INTERVAL = 5


class SensorState:
    """Thread-safe per-sensor connectivity tracker with background reading."""

    def __init__(self, name: str):
        self.name = name
        self._lock = threading.Lock()
        self.connected = False
        self.consecutive_failures = 0
        self.last_success_at: float = 0.0
        self.last_value: dict | None = None
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

    def record_success(self, value: dict):
        """Call after a successful sensor read."""
        with self._lock:
            self.connected = True
            self.consecutive_failures = 0
            self.last_success_at = time.time()
            self.last_value = value

    def record_failure(self):
        """Call after a failed sensor read."""
        with self._lock:
            self.consecutive_failures += 1
            if self.consecutive_failures >= CONSECUTIVE_FAILURES:
                self.connected = False

    def get_status(self) -> dict:
        """Return the current sensor state as a dict for the API response."""
        with self._lock:
            now = time.time()
            seconds_since = now - self.last_success_at if self.last_success_at > 0 else None

            # Mark disconnected if too long since last success
            if self.connected and seconds_since is not None and seconds_since > STALE_SECONDS:
                self.connected = False

            return {
                "connected": self.connected,
                "consecutive_failures": self.consecutive_failures,
                "seconds_since_last_read": round(seconds_since, 1) if seconds_since is not None else None,
                "last_value": self.last_value,
            }

    def start(self, read_fn, poll_interval: float):
        """Start a background thread that calls read_fn every poll_interval."""
        if self._thread and self._thread.is_alive():
            return

        def _loop():
            while not self._stop.is_set():
                try:
                    value = read_fn()
                    if value is not None:
                        self.record_success(value)
                    else:
                        self.record_failure()
                except Exception as e:
                    print("[SensorState:%s] Error: %s" % (self.name, e))
                    self.record_failure()
                self._stop.wait(poll_interval)

        self._thread = threading.Thread(target=_loop, daemon=True, name=f"sensor-{self.name}")
        self._thread.start()

    def stop(self):
        """Signal the background thread to stop."""
        self._stop.set()


# ── Sensor read functions (import from existing modules) ──────────────

def _read_gps_value() -> dict | None:
    """Read GPS and return a value dict, or None on failure.
    Fast-fail: if first 5 serial reads contain no NMEA data, abort immediately."""
    from gps_module.gps_api import GPS_PORT, GPS_BAUD
    import serial
    try:
        ser = serial.Serial(GPS_PORT, GPS_BAUD, timeout=1)
    except Exception:
        return None
    try:
        for _ in range(5):
            line = ser.readline().decode('ascii', errors='ignore').strip()
            if not line:
                continue
            if line.startswith('$GPGGA') or line.startswith('$GNGGA'):
                import pynmea2
                msg = pynmea2.parse(line)
                if msg.latitude and msg.longitude:
                    from gps_module.gps_api import _reverse_geocode
                    lat = msg.latitude
                    lng = msg.longitude
                    loc = _reverse_geocode(lat, lng) or f"{lat}, {lng}"
                    return {
                        "latitude": lat,
                        "longitude": lng,
                        "altitude": float(msg.altitude or 0),
                        "satellites": int(msg.num_sats or 0),
                        "location_name": loc,
                    }
        return None
    finally:
        try:
            ser.close()
        except Exception:
            pass


def _read_dht11_value() -> dict | None:
    """Read DHT11 and return a value dict, or None on failure.
    Retries up to 3 times with backoff to handle transient port contention."""
    from dht11_module.dht11_api import _read_dht11_with_timeout
    for attempt in range(3):
        data, err = _read_dht11_with_timeout()
        if data:
            return {
                "temperature": data["temperature"],
                "relative_humidity": data["relative_humidity"],
            }
        if err:
            print("[DHT11] Attempt %d failed: %s" % (attempt + 1, err))
        if attempt < 2:
            time.sleep(2 * (attempt + 1))
    return None


# ── Singleton sensor states (importable across modules) ───────────────
gps_state = SensorState("gps")
dht11_state = SensorState("dht11")


def start_background_readers():
    """Start background sensor readers. Called once at module import / app startup.
    GPS starts first. DHT11 waits for GPS to finish (release the port if shared)."""
    gps_state.start(_read_gps_value, GPS_POLL_INTERVAL)
    # Wait for GPS first attempt to complete before starting DHT11
    # This avoids port conflicts when both sensors share a COM port
    def _start_dht11_later():
        time.sleep(15)
        dht11_state.start(_read_dht11_value, DHT11_POLL_INTERVAL)
    threading.Thread(target=_start_dht11_later, daemon=True).start()
