from geopy.distance import geodesic

from .overpass_client import query_overpass


def _build_station_query(latitude: float, longitude: float, radius_m: int):
        return f"""
        [out:json][timeout:60];
        (
            node["man_made"="monitoring_station"](around:{radius_m},{latitude},{longitude});
            node["man_made"="monitoring_station"]["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
            node["waterway"="river_gauge"](around:{radius_m},{latitude},{longitude});
            node["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
            node["monitoring"~"water_level|river_level|stage",i](around:{radius_m},{latitude},{longitude});
            node["description"~"gauge|gauging|water level",i](around:{radius_m},{latitude},{longitude});

            way["man_made"="monitoring_station"](around:{radius_m},{latitude},{longitude});
            way["man_made"="monitoring_station"]["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
            way["waterway"="river_gauge"](around:{radius_m},{latitude},{longitude});
            way["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
            way["monitoring"~"water_level|river_level|stage",i](around:{radius_m},{latitude},{longitude});

            relation["man_made"="monitoring_station"](around:{radius_m},{latitude},{longitude});
            relation["man_made"="monitoring_station"]["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
            relation["waterway"="river_gauge"](around:{radius_m},{latitude},{longitude});
            relation["monitoring:water_level"](around:{radius_m},{latitude},{longitude});
            relation["monitoring"~"water_level|river_level|stage",i](around:{radius_m},{latitude},{longitude});
        );
        out center tags;
        """


def _extract_element_coordinates(element: dict):
    """Return (lat, lon) from node/way/relation element payloads."""
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]

    center = element.get("center")
    if center and "lat" in center and "lon" in center:
        return center["lat"], center["lon"]

    return None, None


def get_nearest_waterlevel_station(
    latitude: float,
    longitude: float,
    radius_m: int = 10000,
    query_point: tuple[float, float] | None = None,
):
    """Find nearest water-level gauging station using river-point-first and fallback search."""
    query_lat, query_lon = query_point if query_point else (latitude, longitude)
    search_centers = [("nearest_river_point", latitude, longitude)]
    if (query_lat, query_lon) != (latitude, longitude):
        search_centers.append(("original_query_point", query_lat, query_lon))

    search_radii = (radius_m, radius_m * 2, radius_m * 3)
    nearest_station = None
    min_distance_km = float("inf")
    last_error = None
    had_successful_query = False

    for search_label, search_lat, search_lon in search_centers:
        for search_radius in search_radii:
            query = _build_station_query(search_lat, search_lon, search_radius)
            data, error = query_overpass(query)
            if error:
                last_error = error
                continue

            had_successful_query = True
            for element in data.get("elements", []):
                station_lat, station_lon = _extract_element_coordinates(element)
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
                        "search_center": {
                            "mode": search_label,
                            "lat": search_lat,
                            "lon": search_lon,
                        },
                        "search_radius_m": search_radius,
                    }
                    min_distance_km = distance_km

    if nearest_station:
        return nearest_station, None
    if had_successful_query:
        return None, None
    return None, last_error
