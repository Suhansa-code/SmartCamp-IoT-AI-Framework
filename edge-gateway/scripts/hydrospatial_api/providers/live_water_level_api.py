import requests
from datetime import datetime, timezone

BASE_URL = "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query"

# Function to get the latest gauge data for a given station name - But Response contain all recodes
def get_gauge_data(gauge_name, include_geometry=False):

    params = {
        "where": f"gauge='{gauge_name}'",
        "outFields": "*",
        "returnGeometry": str(include_geometry).lower(),
        "orderByFields": "EditDate ASC",
        "f": "json"
    }

    response = requests.get(BASE_URL, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()

    if not data.get("features"):
        return None

    feature = data["features"][-1]

    attr = feature["attributes"]

    result = {
        "gauge": attr.get("gauge"),
        "basin": attr.get("basin"),
        "water_level": attr.get("water_level"),
        "rainfall": attr.get("rain_fall"),
        "alert_level": attr.get("alertpull"),
        "minor_flood_level": attr.get("minorpull"),
        "major_flood_level": attr.get("majorpull"),
    }

    if include_geometry:
        geom = feature.get("geometry", {})
        result["latitude"] = geom.get("y")
        result["longitude"] = geom.get("x")

    return result


# Function to get only the latest gauge data from the response - Suitable for less bandwidth
def get_latest_gauge_data(gauge_name, include_geometry=False):

    params = {
        "where": f"gauge='{gauge_name}'",
        "outFields": "*",
        "returnGeometry": str(include_geometry).lower(),
        "orderByFields": "EditDate DESC",
        "resultRecordCount": 1,
        "f": "json"
    }

    response = requests.get(BASE_URL, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()

    if not data.get("features"):
        return None

    feature = data["features"][0]

    attr = feature["attributes"]

    result = {
        "gauge": attr.get("gauge"),
        "basin": attr.get("basin"),
        "water_level": attr.get("water_level"),
        "rainfall": attr.get("rain_fall"),
        "alert_level": attr.get("alertpull"),
        "minor_flood_level": attr.get("minorpull"),
        "major_flood_level": attr.get("majorpull"),
        "created_at": attr.get("CreationDate"),
        "updated_at": attr.get("EditDate")
    }

    if include_geometry:
        geom = feature.get("geometry", {})
        result["latitude"] = geom.get("y")
        result["longitude"] = geom.get("x")

    return result


def get_gauge_history(gauge_name, hours=24):
    """
    Query ArcGIS FeatureServer for historical water level readings.
    Returns list of {gauge, water_level, timestamp} sorted chronologically (oldest first).
    """
    record_count = min(hours * 4 + 20, 500)

    params = {
        "where": f"gauge='{gauge_name}'",
        "outFields": "gauge,water_level,EditDate",
        "orderByFields": "EditDate DESC",
        "resultRecordCount": str(record_count),
        "returnGeometry": "false",
        "f": "json"
    }

    response = requests.get(BASE_URL, params=params, timeout=15)
    response.raise_for_status()

    data = response.json()
    features = data.get("features", [])

    readings = []
    for feat in features:
        attr = feat.get("attributes", {})
        water_level = attr.get("water_level")
        edit_date = attr.get("EditDate")
        if water_level is None or edit_date is None:
            continue
        ts = datetime.fromtimestamp(edit_date / 1000, tz=timezone.utc).isoformat()
        readings.append({
            "gauge": attr.get("gauge"),
            "water_level": water_level,
            "timestamp": ts,
        })

    readings.reverse()
    return readings

