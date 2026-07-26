from .providers.gauging_station import get_nearest_waterlevel_station
from .providers.river_lookup import get_nearest_named_river
from .providers.river_shapefile import (
    load_river_data,
    load_gauging_station_data,
    build_river_graph,
    get_station_graph_nodes,
    find_upstream_gauging_station,
)

def find_nearest_gauging_station_detailed(latitude: float, longitude: float):
    """
    Return detailed gauging station info with flood levels using shapefile data.
    Includes alert levels, minor/major flood levels, and upstream station preference.
    """

    
    try:
        # Load geospatial data
        rivers = load_river_data()
        stations = load_gauging_station_data()
        river_graph = build_river_graph(rivers)
        station_graph_nodes = get_station_graph_nodes(stations, river_graph.nodes)

        # Find upstream gauging station (or nearest as fallback)
        result = find_upstream_gauging_station(
            latitude=latitude,
            longitude=longitude,
            rivers=rivers,
            stations=stations,
            graph=river_graph,
            station_node_mapping=station_graph_nodes,
        )

        return result, None

    except Exception as e:
        return None, {"error": f"Detailed station lookup failed: {str(e)}"}


def find_nearest_river_and_station(latitude: float, longitude: float):
    """Return nearest named river and nearest gauging station near that river."""
    river, river_error = get_nearest_named_river(latitude, longitude)
    if river_error:
        return None, {"stage": "river_lookup", **river_error}

    river_lat, river_lon = river["coordinates"]
    station, station_error = get_nearest_waterlevel_station(
        river_lat,
        river_lon,
        query_point=(latitude, longitude),
    )
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
