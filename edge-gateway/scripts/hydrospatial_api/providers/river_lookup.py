from geopy.distance import geodesic

from .overpass_client import query_overpass


def get_nearest_named_river(latitude: float, longitude: float, radius_m: int = 5000):
    """Return nearest named river/stream using center-point distance (fast, no geometry download)."""
    query = f"""
    [out:json][timeout:15];
    (
      way["waterway"="river"](around:{radius_m},{latitude},{longitude});
      way["waterway"="stream"](around:{radius_m},{latitude},{longitude});
    );
    out tags center;
    """

    data, error = query_overpass(query, timeout_s=20)
    if error:
        return None, error

    nearest_river = None
    min_distance_km = float("inf")

    for element in data.get("elements", []):
        name = element.get("tags", {}).get("name", "").strip()
        if not name:
            continue

        # Use center point for ways, lat/lon for nodes
        center = element.get("center")
        if center:
            river_lat, river_lon = center["lat"], center["lon"]
        elif "lat" in element and "lon" in element:
            river_lat, river_lon = element["lat"], element["lon"]
        else:
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
