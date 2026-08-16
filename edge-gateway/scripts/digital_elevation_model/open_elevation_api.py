import json
from urllib import error, parse, request


def fetch_open_elevation(latitude, longitude, timeout=5):
    query = parse.urlencode({"locations": f"{latitude},{longitude}"})
    url = f"https://api.open-elevation.com/api/v1/lookup?{query}"
    with request.urlopen(url, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    results = payload.get("results", [])
    if not results:
        return None

    elevation = results[0].get("elevation")
    return float(elevation) if elevation is not None else None


def build_api_fallback_result(latitude, longitude):
    try:
        elevation = fetch_open_elevation(latitude, longitude)
    except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError):
        elevation = None

    if elevation is None:
        return {
            "latitude": latitude,
            "longitude": longitude,
            "used_latitude": None,
            "used_longitude": None,
            "elevation": None,
            "snap_distance_m": None,
            "source": "none",
            "error": "api_fallback_failed",
        }

    return {
        "latitude": latitude,
        "longitude": longitude,
        "used_latitude": latitude,
        "used_longitude": longitude,
        "elevation": elevation,
        "snap_distance_m": None,
        "source": "open_elevation_api",
        "error": "dem_unavailable_used_api_fallback",
    }
