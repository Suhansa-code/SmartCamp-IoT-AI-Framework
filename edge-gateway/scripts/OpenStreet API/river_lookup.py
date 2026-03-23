import requests
from geopy.distance import geodesic

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def get_nearest_named_river(latitude: float, longitude: float, radius_m: int = 5000):
    """Return nearest named river/stream to the given coordinate."""
    query = f"""
    [out:json][timeout:60];
    (
      way["waterway"="river"](around:{radius_m},{latitude},{longitude});
      way["waterway"="stream"](around:{radius_m},{latitude},{longitude});
    );
    out center tags;
    """

    try:
        response = requests.get(
            OVERPASS_URL,
            params={"data": query},
            headers={"User-Agent": "OpenStreet-API-Script/1.0"},
            timeout=90,
        )
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "")
        if "json" not in content_type.lower():
            return None, {
                "error": "Overpass response was not JSON.",
                "status": response.status_code,
                "content_type": content_type,
                "body_preview": response.text[:500],
            }

        data = response.json()

    except requests.exceptions.RequestException as exc:
        return None, {"error": f"Request failed: {exc}"}
    except ValueError as exc:
        return None, {"error": f"Failed to parse JSON: {exc}"}

    nearest_river = None
    min_distance_km = float("inf")

    for element in data.get("elements", []):
        center = element.get("center")
        if not center:
            continue

        name = element.get("tags", {}).get("name", "").strip()
        if not name:
            continue

        river_lat = center.get("lat")
        river_lon = center.get("lon")
        if river_lat is None or river_lon is None:
            continue

        distance_km = geodesic((latitude, longitude), (river_lat, river_lon)).km
        if distance_km < min_distance_km:
            nearest_river = {
                "name": name,
                "distance_km": round(distance_km, 3),
                "coordinates": (river_lat, river_lon),
                "osm_id": element.get("id"),
                "osm_type": element.get("type"),
            }
            min_distance_km = distance_km

    if nearest_river is None:
        return None, {"error": "No named rivers/streams found in the selected radius."}

    return nearest_river, None
