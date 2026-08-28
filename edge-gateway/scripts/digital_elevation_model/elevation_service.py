"""
elevation_service.py — DEM-based elevation service with caching.

Provides a clean interface for obtaining elevation for any coordinate.
Uses local DEM raster as primary source, Open-Elevation API as fallback.
Results are cached because elevation does not change.
"""
import time
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── In-memory cache ──────────────────────────────────────────────────────
_cache = {}
_CACHE_TTL = 86400  # 24 hours — elevation rarely changes


def _cache_key(lat: float, lon: float) -> str:
    """Round to 5 decimal places (~1m precision) for cache key."""
    return f"{lat:.5f},{lon:.5f}"


def get_elevation(latitude: float, longitude: float, use_api_fallback: bool = True) -> dict:
    """
    Get elevation for a coordinate.

    Returns dict with:
      latitude, longitude, elevation_m, source, timestamp, error (if any)
    """
    now = datetime.now(timezone.utc).isoformat()

    # ── Validate coordinates ─────────────────────────────────────────────
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        return {
            "latitude": latitude,
            "longitude": longitude,
            "elevation_m": None,
            "source": "invalid",
            "timestamp": now,
            "error": "Invalid coordinates: latitude must be [-90,90], longitude must be [-180,180]",
        }

    # ── Check cache ──────────────────────────────────────────────────────
    key = _cache_key(latitude, longitude)
    cached = _cache.get(key)
    if cached and (time.time() - cached["ts"] < _CACHE_TTL):
        result = cached["result"].copy()
        result["timestamp"] = now
        result["cached"] = True
        return result

    # ── Try local DEM first ──────────────────────────────────────────────
    dem_result = _try_dem(latitude, longitude)
    if dem_result["elevation_m"] is not None:
        dem_result["timestamp"] = now
        _cache[key] = {"result": dem_result, "ts": time.time()}
        return dem_result

    # ── Fallback to Open-Elevation API ───────────────────────────────────
    if use_api_fallback:
        api_result = _try_open_elevation(latitude, longitude)
        if api_result["elevation_m"] is not None:
            api_result["timestamp"] = now
            _cache[key] = {"result": api_result, "ts": time.time()}
            return api_result
        # Both failed — return the DEM error with API fallback error
        dem_result["timestamp"] = now
        dem_result["fallback_error"] = api_result.get("error")
        return dem_result

    dem_result["timestamp"] = now
    return dem_result


def _try_dem(latitude: float, longitude: float) -> dict:
    """Attempt to get elevation from the local DEM raster."""
    try:
        from .digital_elevation_algorithm import get_elevations_batch

        results = get_elevations_batch(
            [(latitude, longitude)],
            snap_outside_to_nearest=True,
            max_snap_distance_m=500,
            use_api_fallback=False,
        )

        if not results:
            return {
                "latitude": latitude,
                "longitude": longitude,
                "elevation_m": None,
                "source": "dem",
                "error": "DEM returned no results",
            }

        item = results[0]
        elevation = item.get("elevation")
        error = item.get("error")

        if elevation is not None:
            return {
                "latitude": latitude,
                "longitude": longitude,
                "elevation_m": round(float(elevation), 2),
                "source": "dem",
                "error": None,
            }

        return {
            "latitude": latitude,
            "longitude": longitude,
            "elevation_m": None,
            "source": "dem",
            "error": error or "DEM elevation is None",
        }

    except ImportError:
        return {
            "latitude": latitude,
            "longitude": longitude,
            "elevation_m": None,
            "source": "dem",
            "error": "DEM dependencies not available (rasterio/pyproj)",
        }
    except Exception as exc:
        logger.warning(f"[ELEVATION] DEM lookup failed: {exc}")
        return {
            "latitude": latitude,
            "longitude": longitude,
            "elevation_m": None,
            "source": "dem",
            "error": f"DEM error: {str(exc)}",
        }


def _try_open_elevation(latitude: float, longitude: float) -> dict:
    """Attempt to get elevation from the Open-Elevation API."""
    try:
        from .open_elevation_api import fetch_open_elevation

        elevation = fetch_open_elevation(latitude, longitude, timeout=10)

        if elevation is not None:
            return {
                "latitude": latitude,
                "longitude": longitude,
                "elevation_m": round(float(elevation), 2),
                "source": "open_elevation_api",
                "error": None,
            }

        return {
            "latitude": latitude,
            "longitude": longitude,
            "elevation_m": None,
            "source": "open_elevation_api",
            "error": "Open-Elevation returned no data",
        }

    except Exception as exc:
        logger.warning(f"[ELEVATION] Open-Elevation fallback failed: {exc}")
        return {
            "latitude": latitude,
            "longitude": longitude,
            "elevation_m": None,
            "source": "open_elevation_api",
            "error": f"API fallback failed: {str(exc)}",
        }


def get_elevations_batch(latitude: float, longitude: float, count: int = 1, **kwargs) -> list:
    """Batch elevation for multiple nearby points (for future use)."""
    return [get_elevation(latitude, longitude, **kwargs)]
