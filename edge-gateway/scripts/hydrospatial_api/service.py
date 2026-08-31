import time
import logging

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
from digital_elevation_model.elevation_service import get_elevation

logger = logging.getLogger(__name__)

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
    """Full live payload: river (Overpass), station (CSV+graph), live gauge (ArcGIS), DEM elevation."""
    from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

    OVERPASS_STEP_TIMEOUT = 35  # seconds per Overpass-dependent step

    payload = {
        "query_location": {"lat": latitude, "lon": longitude, "alt": altitude},
        "nearest_river": None,
        "gauging_station": None,
        "live_gauge_data": None,
        "camp_elevation": None,
        "errors": {},
    }

    # ── DEM elevation (no Overpass, fast) ────────────────────────────────
    try:
        camp_elev = get_elevation(latitude, longitude, use_api_fallback=True)
        if camp_elev.get("elevation_m") is not None:
            payload["camp_elevation"] = camp_elev["elevation_m"]
        else:
            payload["errors"]["elevation"] = camp_elev.get("error", "Elevation unavailable")
    except Exception as exc:
        payload["errors"]["elevation"] = str(exc)

    # ── River lookup (Overpass, with timeout) ─────────────────────────────
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(get_nearest_named_river, latitude, longitude)
            nearest_river, river_error = future.result(timeout=OVERPASS_STEP_TIMEOUT)
        if river_error:
            payload["errors"]["river_lookup"] = river_error
        else:
            payload["nearest_river"] = nearest_river
    except FuturesTimeout:
        payload["errors"]["river_lookup"] = f"River lookup timed out after {OVERPASS_STEP_TIMEOUT}s"
    except Exception as exc:
        payload["errors"]["river_lookup"] = str(exc)

    # ── Gauging station (Overpass + shapefile, with timeout) ──────────────
    detailed_result = None
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(find_nearest_gauging_station_detailed, latitude, longitude)
            detailed_result, detailed_error = future.result(timeout=OVERPASS_STEP_TIMEOUT)
        if detailed_error:
            payload["errors"]["gauging_station"] = detailed_error
        else:
            payload["gauging_station"] = detailed_result
    except FuturesTimeout:
        payload["errors"]["gauging_station"] = f"Gauging station lookup timed out after {OVERPASS_STEP_TIMEOUT}s"
    except Exception as exc:
        payload["errors"]["gauging_station"] = str(exc)

    # ── Live gauge data (ArcGIS, with timeout) ───────────────────────────
    station_name = detailed_result.get("station_name") if detailed_result else ""
    if station_name:
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(get_latest_gauge_data, station_name, True)
                payload["live_gauge_data"] = future.result(timeout=15)
        except FuturesTimeout:
            payload["errors"]["live_gauge_data"] = "Gauge data fetch timed out"
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

    # Use DEM elevation if available, fallback to station elevation or altitude parameter
    dem_elevation = payload.get("camp_elevation") or station.get("elevation") or altitude

    inputs = {
        "rainfall_mm": gauge.get("rainfall") or 0.0,
        "longitude": longitude,
        "latitude": latitude,
        "altitude_m": altitude,
        "dem_elevation_m": dem_elevation,
        "nearest_river_m": nearest_river_m,
        "water_level_m": gauge.get("water_level") or 0.0,
        "is_forecast": True,
        "gauge_alert_level": gauge.get("alert_level") or station.get("alert_level") or 2.0,
        "gauge_minor_level": gauge.get("minor_flood_level") or station.get("minor_level") or 3.0,
        "gauge_major_level": gauge.get("major_flood_level") or station.get("major_level") or 5.0,
        "return_shap": True,
    }

    try:
        prediction = run_prediction(inputs)
    except Exception as exc:
        logger.error(f"[PREDICTION] Model prediction failed for ({latitude}, {longitude}): {exc}", exc_info=True)
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


def build_local_prediction(inputs: dict):
    """Run prediction with a pre-assembled feature vector (no external API fetches).

    Unlike build_live_prediction, this bypasses all data gathering (Overpass, ArcGIS, DEM)
    and feeds the provided inputs directly to the XGBoost model.
    """
    try:
        prediction = run_prediction(inputs)
    except Exception as exc:
        logger.error(f"[PREDICTION] Local prediction failed: {exc}", exc_info=True)
        return {
            "prediction": None,
            "inputs": inputs,
            "source_data": {},
            "errors": {"prediction": f"Prediction failed: {exc}"},
        }, {"error": f"Prediction failed: {exc}"}

    return {
        "prediction": prediction,
        "inputs": inputs,
        "source_data": {},
        "errors": {},
    }, None


def build_hydrospatial_analysis(latitude: float, longitude: float, altitude: float = 10.0):
    """
    Complete hydro-spatial analysis for a camp location.

    Combines DEM elevation, river/station lookup, and live gauge data
    into a single structured payload with spatial relationships.

    Each Overpass-dependent step runs with an independent timeout so that
    a slow/unresponsive Overpass API does not block the entire analysis.
    """
    from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
    from geopy.distance import geodesic

    OVERPASS_STEP_TIMEOUT = 35  # seconds per Overpass-dependent step

    payload = {
        "query_location": {"lat": latitude, "lon": longitude, "alt": altitude},
        "camp_elevation": None,
        "gauge_elevation": None,
        "elevation_difference": None,
        "river_name": None,
        "river_distance_km": None,
        "station_name": None,
        "gauge_distance_km": None,
        "gauge_latitude": None,
        "gauge_longitude": None,
        "nearest_river": None,
        "gauging_station": None,
        "live_gauge_data": None,
        "errors": {},
    }

    # ── Step 1: Get camp elevation from DEM (no Overpass, fast) ──────────
    try:
        camp_elev = get_elevation(latitude, longitude, use_api_fallback=True)
        if camp_elev.get("elevation_m") is not None:
            payload["camp_elevation"] = camp_elev["elevation_m"]
        else:
            payload["errors"]["camp_elevation"] = camp_elev.get("error", "Elevation unavailable")
    except Exception as exc:
        payload["errors"]["camp_elevation"] = str(exc)

    # ── Step 2: Find nearest river (Overpass, with timeout) ──────────────
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(get_nearest_named_river, latitude, longitude)
            nearest_river, river_error = future.result(timeout=OVERPASS_STEP_TIMEOUT)
        if river_error:
            payload["errors"]["river_lookup"] = river_error
        else:
            payload["nearest_river"] = nearest_river
            payload["river_name"] = nearest_river.get("name")
            payload["river_distance_km"] = nearest_river.get("distance_km")
    except FuturesTimeout:
        payload["errors"]["river_lookup"] = f"River lookup timed out after {OVERPASS_STEP_TIMEOUT}s"
        logger.warning(f"[HYDROSPATIAL] River lookup timed out for ({latitude}, {longitude})")
    except Exception as exc:
        payload["errors"]["river_lookup"] = str(exc)

    # ── Step 3: Find gauging station (Overpass + shapefile, with timeout) ─
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(find_nearest_gauging_station_detailed, latitude, longitude)
            detailed_result, detailed_error = future.result(timeout=OVERPASS_STEP_TIMEOUT)
        if detailed_error:
            payload["errors"]["gauging_station"] = detailed_error
        else:
            payload["gauging_station"] = detailed_result
            payload["station_name"] = detailed_result.get("station_name")
            gauge_lat = detailed_result.get("gauge_latitude")
            gauge_lon = detailed_result.get("gauge_longitude")
            payload["gauge_latitude"] = gauge_lat
            payload["gauge_longitude"] = gauge_lon

            # Use river name from shapefile if Overpass failed
            if payload["river_name"] is None and detailed_result.get("nearest_river_name"):
                payload["river_name"] = detailed_result["nearest_river_name"]

            # Use river name from station CSV if still None
            if payload["river_name"] is None and detailed_result.get("river_name"):
                payload["river_name"] = detailed_result["river_name"]

            # Use river distance from shapefile if Overpass failed
            if payload["river_distance_km"] is None and detailed_result.get("distance_to_river_meters"):
                payload["river_distance_km"] = round(detailed_result["distance_to_river_meters"] / 1000, 3)

            if gauge_lat is not None and gauge_lon is not None:
                dist = geodesic((latitude, longitude), (gauge_lat, gauge_lon)).km
                payload["gauge_distance_km"] = round(dist, 2)
    except FuturesTimeout:
        payload["errors"]["gauging_station"] = f"Gauging station lookup timed out after {OVERPASS_STEP_TIMEOUT}s"
        logger.warning(f"[HYDROSPATIAL] Gauging station lookup timed out for ({latitude}, {longitude})")
    except Exception as exc:
        payload["errors"]["gauging_station"] = str(exc)

    # ── Step 4: Get gauge elevation from DEM (no Overpass, fast) ─────────
    if payload["gauge_latitude"] is not None and payload["gauge_longitude"] is not None:
        try:
            gauge_elev = get_elevation(
                payload["gauge_latitude"], payload["gauge_longitude"],
                use_api_fallback=True,
            )
            if gauge_elev.get("elevation_m") is not None:
                payload["gauge_elevation"] = gauge_elev["elevation_m"]
            else:
                payload["errors"]["gauge_elevation"] = gauge_elev.get("error", "Gauge elevation unavailable")
        except Exception as exc:
            payload["errors"]["gauge_elevation"] = str(exc)

    # ── Step 5: Calculate elevation difference ───────────────────────────
    if payload["camp_elevation"] is not None and payload["gauge_elevation"] is not None:
        payload["elevation_difference"] = round(payload["camp_elevation"] - payload["gauge_elevation"], 2)

    # ── Step 6: Get live gauge data (ArcGIS, with timeout) ───────────────
    station_name = payload.get("station_name")
    if station_name:
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(get_latest_gauge_data, station_name, True)
                payload["live_gauge_data"] = future.result(timeout=15)
        except FuturesTimeout:
            payload["errors"]["live_gauge_data"] = "Gauge data fetch timed out"
        except Exception as exc:
            payload["errors"]["live_gauge_data"] = str(exc)

    return payload
