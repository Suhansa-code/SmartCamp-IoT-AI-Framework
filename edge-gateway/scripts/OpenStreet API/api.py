from flask import Flask, jsonify, request

from gauging_station import get_nearest_waterlevel_station
from river_lookup import get_nearest_named_river

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/nearest-river-gauging-station")
def nearest_river_gauging_station():
    lat_raw = request.args.get("lat")
    lon_raw = request.args.get("lon")

    if lat_raw is None or lon_raw is None:
        return jsonify({"error": "Query parameters 'lat' and 'lon' are required."}), 400

    try:
        latitude = float(lat_raw)
        longitude = float(lon_raw)
    except ValueError:
        return jsonify({"error": "Invalid coordinates. 'lat' and 'lon' must be numeric."}), 400

    river, river_error = get_nearest_named_river(latitude, longitude)
    if river_error:
        return jsonify(river_error), 502

    river_lat, river_lon = river["coordinates"]
    station, station_error = get_nearest_waterlevel_station(river_lat, river_lon)
    if station_error:
        return jsonify({"river": river, "station_error": station_error}), 502

    if station is None:
        return jsonify({
            "river": river,
            "message": "No nearby water-level gauging station found near the nearest river.",
        }), 404

    return jsonify({
        "river": river,
        "gauging_station": station,
        "query_point": {"lat": latitude, "lon": longitude},
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
