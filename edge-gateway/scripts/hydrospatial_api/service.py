import time

from .providers.gauging_station import get_nearest_waterlevel_station
from .providers.river_lookup import get_nearest_named_river
from .providers.live_water_level_api import get_latest_gauge_data
from .providers.prediction import run_prediction
from .providers.river_shapefile import (
    load_river_data,
    load_gauging_station_data,
    build_river_graph,
    get_station_graph_nodes,
    find_upstream_gauging_station,
)

# In-memory cache: river/station data for a location rarely changes
_cache = {}
_CACHE_TTL = 3600  # 1 hour


def find_nearest_gauging_station_detailed(latitude: float, longitude: float):
    """
    Return detailed gauging station info with flood levels using shapefile data.
    Includes alert levels, minor/major flood levels, and upstream station preference.
    """
    try:
        rivers = load_river_data()
        stations = load_gauging_station_data()
        river_graph = build_river_graph(rivers)
        station_graph_nodes = get_station_graph_nodes(stations, river_graph.nodes)

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
    """Return nearest named river and nearest gauging station — with caching."""
    cache_key = f"{latitude:.4f},{longitude:.4f}"
    cached = _cache.get(cache_key)
    if cached and (time.time() - cached["ts"] < _CACHE_TTL):
        return cached["result"], None

    try:
        river, river_error = get_nearest_named_river(latitude, longitude)
    except Exception as exc:
        river, river_error = None, {"error": str(exc)}

    station = None
    station_error = None
    if river and not river_error:
        time.sleep(2)
        try:
            station, station_error = get_nearest_waterlevel_station(
                latitude, longitude, 10000, (latitude, longitude),
            )
        except Exception as exc:
            station, station_error = None, {"error": str(exc)}

    if river_error and not river:
        return None, {"stage": "river_lookup", **river_error}

    if station_error and not station:
        return None, {
            "stage": "gauging_station",
            "river": river,
            "error": station_error,
        }

    result = {
        "river": river,
        "gauging_station": station,
        "query_point": {"lat": latitude, "lon": longitude},
    }

    _cache[cache_key] = {"result": result, "ts": time.time()}
    return result, None


def build_live_payload(latitude: float, longitude: float, altitude: float = 10.0):
    """Full live payload: river (Overpass), station (CSV+graph), live gauge (ArcGIS)."""
    payload = {
        "query_location": {"lat": latitude, "lon": longitude, "alt": altitude},
        "nearest_river": None,
        "gauging_station": None,
        "live_gauge_data": None,
        "errors": {},
    }

    try:
        nearest_river, river_error = get_nearest_named_river(latitude, longitude)
        if river_error:
            payload["errors"]["river_lookup"] = river_error
        else:
            payload["nearest_river"] = nearest_river
    except Exception as exc:
        payload["errors"]["river_lookup"] = str(exc)

    try:
        detailed_result, detailed_error = find_nearest_gauging_station_detailed(latitude, longitude)
        if detailed_error:
            payload["errors"]["gauging_station"] = detailed_error
        else:
            payload["gauging_station"] = detailed_result
    except Exception as exc:
        payload["errors"]["gauging_station"] = str(exc)
        detailed_result = None

    station_name = detailed_result.get("station_name") if detailed_result else ""
    if station_name:
        try:
            payload["live_gauge_data"] = get_latest_gauge_data(station_name, include_geometry=True)
        except Exception as exc:
            payload["errors"]["live_gauge_data"] = str(exc)

    return payload


def build_live_prediction(latitude: float, longitude: float, altitude: float = 10.0):
    """Run the live flood prediction model with current gauge data."""
    payload = build_live_payload(latitude, longitude, altitude)

    gauge = payload.get("live_gauge_data") or {}
    station = payload.get("gauging_station") or {}

    # distance to river: prefer the detailed station river distance, fallback to nearest river km
    nearest_river_m = station.get("distance_to_river_meters") or 0
    if not nearest_river_m:
        river = payload.get("nearest_river") or {}
        nearest_river_m = (river.get("distance_km") or 0) * 1000

    inputs = {
        "rainfall_mm": gauge.get("rainfall") or 0.0,
        "longitude": longitude,
        "latitude": latitude,
        "altitude_m": altitude,
        "dem_elevation_m": station.get("elevation"),
        "nearest_river_m": nearest_river_m,
        "gauging_station_current_water_level_m": gauge.get("water_level") or 0.0,
        "is_forecast": True,
    }

    try:
        prediction = run_prediction(inputs)
    except Exception as exc:
        return {
            "prediction": None,
            "inputs": inputs,
            "source_data": {
                "station_name": station.get("station_name"),
                "river_name": station.get("river_name"),
                "water_level": gauge.get("water_level"),
                "rainfall": gauge.get("rainfall"),
            },
            "errors": {
                **payload.get("errors", {}),
                "prediction": f"Prediction failed: {exc}",
            },
        }, {"error": f"Prediction failed: {exc}", "errors": payload.get("errors", {})}

    return {
        "prediction": prediction,
        "inputs": inputs,
        "source_data": {
            "station_name": station.get("station_name"),
            "river_name": station.get("river_name"),
            "water_level": gauge.get("water_level"),
            "rainfall": gauge.get("rainfall"),
        },
        "errors": payload.get("errors", {}),
    }, None
