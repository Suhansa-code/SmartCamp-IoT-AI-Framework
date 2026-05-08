from service import find_nearest_gauging_station_detailed
from providers.river_lookup import get_nearest_named_river

# Camp GPS location
LATITUDE = 6.22066
LONGITUDE = 80.28489


if __name__ == "__main__":
    print("=" * 60)
    print("SMART CAMP - WATER LEVEL MONITORING")
    print("=" * 60)
    print(f"\nQuery Location: Lat {LATITUDE}, Lon {LONGITUDE}")
    print("-" * 60)

    # Get nearest named river and detailed gauging station information
    nearest_river, river_error = get_nearest_named_river(LATITUDE, LONGITUDE)
    detailed_result, detailed_error = find_nearest_gauging_station_detailed(LATITUDE, LONGITUDE)

    if river_error:
        print(f"❌ River lookup failed: {river_error}")
        raise SystemExit(1)

    if detailed_error:
        print(f"❌ Lookup failed: {detailed_error}")
        raise SystemExit(1)

    if nearest_river:
        print(f"Nearest water path name: {nearest_river.get('name', 'N/A')}")

    if detailed_result:
        print(f"Nearest River (CSV): {detailed_result.get('river_name') or detailed_result.get('river', 'N/A')}")
        print("\n📍 GAUGING STATION DETAILS:")
        print(f"   Station Name: {detailed_result.get('station_name', 'N/A')}")
        print(f"   Station River: {detailed_result.get('river_name') or detailed_result.get('river', 'N/A')}")
        print(f"   Distance to Gauging Station: {detailed_result.get('distance_to_station_meters', detailed_result.get('distance_meters', 'N/A'))} meters")
        print(f"   Distance to Upstream River: {detailed_result.get('distance_to_river_meters', 'N/A')} meters")
        print(f"   Type: {detailed_result.get('type', 'N/A')}")

        # Flood level information
        alert_level = detailed_result.get('alert_level')
        minor_flood = detailed_result.get('minor_flood_level')
        major_flood = detailed_result.get('major_flood_level')

        if alert_level is not None or minor_flood is not None or major_flood is not None:
            print("\n🌊 WATER LEVEL THRESHOLDS:")
            if alert_level is not None:
                print(f"   Normal/Alert Level: {alert_level} m")
            if minor_flood is not None:
                print(f"   Minor Flood Level: {minor_flood} m")
            if major_flood is not None:
                print(f"   Major Flood Level: {major_flood} m")
        else:
            print("\n   No flood level data available")
    else:
        print("No gauging station found")

    print("\n" + "=" * 60)
