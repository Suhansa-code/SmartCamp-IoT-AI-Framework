from service import find_nearest_river_and_station

# Camp GPS location
LATITUDE = 6.501
LONGITUDE = 81.398


if __name__ == "__main__":
    result, error = find_nearest_river_and_station(LATITUDE, LONGITUDE)

    if error:
        print("Lookup failed:", error)
        raise SystemExit(1)

    river = result["river"]
    station = result["gauging_station"]

    print("Nearest River:", river["name"])
    print("River Distance (km):", river["distance_km"])

    if station is None:
        print("No nearby water-level gauging station found near the nearest river.")
    else:
        print("Nearest Water-Level Gauging Station:", station["name"])
        print("Distance (km):", station["distance_km"])
        print("OSM ID:", station["osm_id"])
        print("OSM Type:", station["osm_type"])
        print("Operator:", station["operator"])
        print("Reference:", station["ref"])
        print("Coordinates:", station["coordinates"])
