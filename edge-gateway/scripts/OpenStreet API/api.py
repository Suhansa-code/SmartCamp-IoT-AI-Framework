from flask import Flask, jsonify, request

from service import find_nearest_river_and_station

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

    result, error = find_nearest_river_and_station(latitude, longitude)
    if error:
        return jsonify(error), 502

    if result["gauging_station"] is None:
        return jsonify({
            "river": result["river"],
            "message": "No nearby water-level gauging station found near the nearest river.",
        }), 404

    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
