from geopy.distance import geodesic

from .overpass_client import query_overpass


def get_nearest_waterlevel_station(
    latitude: float,
    longitude: float,
    radius_m: int = 10000,
    query_point: tuple[float, float] | None = None,
):
    """Find nearest water-level gauging station — single fast query."""
    query_lat, query_lon = query_point if query_point else (latitude, longitude)

    query = f"""
    [out:json][timeout:15];
    (
        node["man_made"="monitoring_station"](around:{radius_m},{latitude},{longitude});
        node["waterway"="river_gauge"](around:{radius_m},{latitude},{longitude});
    );
    out tags;
    """

    data, error = query_overpass(query, timeout_s=20)

    if error:
        return None, error

    nearest_station = None
    min_distance_km = float("inf")

    for element in data.get("elements", []):
        station_lat = element.get("lat")
        station_lon = element.get("lon")
        if station_lat is None or station_lon is None:
            continue

        distance_km = geodesic((query_lat, query_lon), (station_lat, station_lon)).km
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

    if nearest_station:
        return nearest_station, None
    return None, None
