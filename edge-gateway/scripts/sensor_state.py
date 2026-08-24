"""
sensor_state.py — Persistent per-sensor connectivity tracker.

Each sensor (GPS, DHT11) is independently tracked across requests.
A sensor is marked "connected" only after a successful read,
and "disconnected" after CONSECUTIVE_FAILURES threshold is exceeded.
"""
import time
import threading
from datetime import datetime, timezone

# How many consecutive read failures before marking disconnected
CONSECUTIVE_FAILURES = 3

# How many seconds of no successful read before considering stale
STALE_SECONDS = 30


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


# ── Singleton sensor states (importable across modules) ───────────────
gps_state = SensorState("gps")
dht11_state = SensorState("dht11")
