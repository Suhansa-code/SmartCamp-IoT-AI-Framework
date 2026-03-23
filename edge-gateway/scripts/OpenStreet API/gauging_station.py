import requests
from geopy.distance import geodesic

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def _extract_element_coordinates(element: dict):
    """Return (lat, lon) from node/way/relation element payloads."""
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]

    center = element.get("center")
    if center and "lat" in center and "lon" in center:
        return center["lat"], center["lon"]

    return None, None


def get_nearest_waterlevel_station(latitude: float, longitude: float, radius_m: int = 10000):
    """Find nearest water-level gauging/monitoring station using OpenStreetMap Overpass."""
    query = f"""
    [out:json][timeout:60];
    (
      node["man_made"="monitoring_station"]["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
      node["waterway"="river_gauge"](around:{radius_m},{latitude},{longitude});
      node["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
      way["man_made"="monitoring_station"]["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
      way["waterway"="river_gauge"](around:{radius_m},{latitude},{longitude});
      relation["man_made"="monitoring_station"]["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
      relation["waterway"="river_gauge"](around:{radius_m},{latitude},{longitude});
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

    nearest_station = None
    min_distance_km = float("inf")

    for element in data.get("elements", []):
        station_lat, station_lon = _extract_element_coordinates(element)
        if station_lat is None or station_lon is None:
            continue

        distance_km = geodesic((latitude, longitude), (station_lat, station_lon)).km
        if distance_km < min_distance_km:
            tags = element.get("tags", {})
            nearest_station = {
                "name": tags.get("name") or "Unnamed Gauging Station",
                "distance_km": round(distance_km, 3),
                "osm_id": element.get("id"),
                "osm_type": element.get("type"),
                "operator": tags.get("operator", "Unknown"),
                "ref": tags.get("ref", "N/A"),
                "coordinates": (station_lat, station_lon),
            }
            min_distance_km = distance_km

    return nearest_station, None
