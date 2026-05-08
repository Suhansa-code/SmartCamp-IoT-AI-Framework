from service import find_nearest_river_and_station
from service import find_nearest_gauging_station_detailed

# Camp GPS location
LATITUDE = 6.501
LONGITUDE = 81.398


if __name__ == "__main__":
    print("=" * 60)
    print("SMART CAMP - WATER LEVEL MONITORING")
    print("=" * 60)
    print(f"\nQuery Location: Lat {LATITUDE}, Lon {LONGITUDE}")
    print("-" * 60)

    # Get detailed gauging station information (with flood levels, alerts, etc.)
    detailed_result, detailed_error = find_nearest_gauging_station_detailed(LATITUDE, LONGITUDE)
    result, error = find_nearest_river_and_station(LATITUDE, LONGITUDE)
    river = result["river"]

    if detailed_error:
        print(f"❌ Lookup failed: {detailed_error}")
        raise SystemExit(1)

    if detailed_result:
        print("Nearest River:", river["name"])
        print("\n📍 GAUGING STATION DETAILS:")
        print(f"   Station Name: {detailed_result.get('station_name', 'N/A')}")
        print(f"   Station DB River: {detailed_result.get('river', 'N/A')}")
        print(f"   Distance: {detailed_result.get('distance_meters', 'N/A')} meters")
        print(f"   Type: {detailed_result.get('type', 'N/A')}")

        # Flood level information
        alert_level = detailed_result.get('alert_level')
        minor_flood = detailed_result.get('minor_flood_level')
        major_flood = detailed_result.get('major_flood_level')

        if alert_level is not None or minor_flood is not None or major_flood is not None:
            print("\n🌊 WATER LEVEL THRESHOLDS:")
            if alert_level is not None:
                print(f"   Alert Level: {alert_level} m")
            if minor_flood is not None:
                print(f"   Minor Flood Level: {minor_flood} m")
            if major_flood is not None:
                print(f"   Major Flood Level: {major_flood} m")
        else:
            print("\n   No flood level data available")
    else:
        print("No gauging station found")

    print("\n" + "=" * 60)
