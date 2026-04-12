from providers.gauging_station import get_nearest_waterlevel_station
from providers.river_lookup import get_nearest_named_river


def find_nearest_river_and_station(latitude: float, longitude: float):
    """Return nearest named river and nearest gauging station near that river."""
    river, river_error = get_nearest_named_river(latitude, longitude)
    if river_error:
        return None, {"stage": "river_lookup", **river_error}

    river_lat, river_lon = river["coordinates"]
    station, station_error = get_nearest_waterlevel_station(river_lat, river_lon)
    if station_error:
        return None, {
            "stage": "gauging_station",
            "river": river,
            "error": station_error,
        }

    return {
        "river": river,
        "gauging_station": station,
        "query_point": {"lat": latitude, "lon": longitude},
    }, None
