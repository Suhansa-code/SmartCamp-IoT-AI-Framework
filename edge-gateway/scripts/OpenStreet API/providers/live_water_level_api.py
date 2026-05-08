import requests

BASE_URL = "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query"


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


# Example
print(get_gauge_data("Kithulgala", include_geometry=True))