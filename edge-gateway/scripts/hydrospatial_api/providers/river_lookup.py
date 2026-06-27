from geopy.distance import geodesic
from shapely.geometry import LineString, Point

from .overpass_client import query_overpass


def _nearest_point_on_river(query_lat: float, query_lon: float, geometry: list[dict]):
    """Return nearest point (lat, lon) on a river polyline to the query coordinate."""
    coordinates = []
    for node in geometry:
        lat = node.get("lat")
        lon = node.get("lon")
        if lat is None or lon is None:
            continue
        coordinates.append((float(lon), float(lat)))

    if not coordinates:
        return None

    query_point = Point(query_lon, query_lat)
    if len(coordinates) == 1:
        nearest_point = Point(coordinates[0])
    else:
        river_line = LineString(coordinates)
        nearest_point = river_line.interpolate(river_line.project(query_point))

    return nearest_point.y, nearest_point.x


def get_nearest_named_river(latitude: float, longitude: float, radius_m: int = 50000):
    """Return nearest named river/stream to the given coordinate."""
    query = f"""
    [out:json][timeout:60];
    (
      way["waterway"="river"](around:{radius_m},{latitude},{longitude});
      way["waterway"="stream"](around:{radius_m},{latitude},{longitude});
    );
        out geom tags;
    """

    data, error = query_overpass(query)
    if error:
        return None, error

    nearest_river = None
    min_distance_km = float("inf")

    for element in data.get("elements", []):
        name = element.get("tags", {}).get("name", "").strip()
        if not name:
            continue

        nearest_point = _nearest_point_on_river(latitude, longitude, element.get("geometry", []))
        if nearest_point is None:
            continue
        river_lat, river_lon = nearest_point

        distance_km = geodesic((latitude, longitude), (river_lat, river_lon)).km
        if distance_km < min_distance_km:
            nearest_river = {
                "name": name,
                "distance_km": round(distance_km, 3),
                "coordinates": (river_lat, river_lon),
                "distance_method": "nearest_point_on_segment",
                "osm_id": element.get("id"),
                "osm_type": element.get("type"),
            }
            min_distance_km = distance_km
    if nearest_river is None:
        return None, {"error": "No named rivers/streams found in the selected radius."}

    return nearest_river, None
