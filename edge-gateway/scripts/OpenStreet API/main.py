from service import find_nearest_gauging_station_detailed
from providers.river_lookup import get_nearest_named_river
from providers.weather_forecast_location import fetch_forecast_location
from providers.live_water_level_api import get_latest_gauge_data

# Camp GPS location
LATITUDE = 7.507
LONGITUDE = 80.945
ALTITUDE = 10.0  # meters above sea level (if available)


if __name__ == "__main__":
    print("=" * 60)
    print("SMART CAMP - WATER LEVEL MONITORING")
    print("=" * 60)
    print(f"\nQuery Location: Lat {LATITUDE}, Lon {LONGITUDE}, Alt {ALTITUDE}")
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

        
        # Get live water level data from API
        gauge_data = get_latest_gauge_data(detailed_result.get('station_name', ''), include_geometry=True)
        if gauge_data:
            print("\n💧 LIVE WATER LEVEL DATA:")
            print(f"   Current Water Level: {gauge_data.get('water_level', 'N/A')} m")
            print(f"   Rainfall: {gauge_data.get('rainfall', 'N/A')} mm")
            print(f"   Alert Level: {gauge_data.get('alert_level', 'N/A')} m")
            print(f"   Minor Flood Level: {gauge_data.get('minor_flood_level', 'N/A')} m")
            print(f"   Major Flood Level: {gauge_data.get('major_flood_level', 'N/A')} m")
            if gauge_data.get('latitude') and gauge_data.get('longitude'):
                print(f"   Gauge Location: Lat {gauge_data['latitude']:.4f}, Lon {gauge_data['longitude']:.4f}")

        # Fetch weather forecast for the location
        forecast_data, forecast_error = fetch_forecast_location(LATITUDE, LONGITUDE)
        if forecast_error:
            print(f"\n❌ Weather forecast lookup failed: {forecast_error}")
        else:
            print("\n🌤️ WEATHER FORECAST LOCATION:")
            print(f"   Forecast Location: Lat {forecast_data['forecast_location']['lat']}, Lon {forecast_data['forecast_location']['lon']}")
            print(f"   Elevation: {forecast_data['forecast_location'].get('elevation', 'N/A')} m")
            
            # Display hourly forecast parameters for flood prediction
            hourly_data = forecast_data.get('weather_forecast_parameters', {}).get('hourly', {})
            hourly_units = forecast_data.get('weather_forecast_parameters', {}).get('hourly_units', {})
            
            if hourly_data and hourly_data.get('time'):
                print("\n📊 HOURLY WEATHER FORECAST FOR FLOOD PREDICTION:")
                times = hourly_data.get('time', [])
                print(f"   Forecast Period: {times[0] if times else 'N/A'} to {times[-1] if times else 'N/A'} ({len(times)} hours)")
                
                # Get first and last hour data for summary
                if len(times) > 0:
                    print("\n   🌡️ Temperature & Humidity:")
                    temps = hourly_data.get('temperature_2m', [])
                    humidity = hourly_data.get('relative_humidity_2m', [])
                    print(f"      Min Temp: {min(temps) if temps else 'N/A'}°C, Max Temp: {max(temps) if temps else 'N/A'}°C")
                    print(f"      Avg Humidity: {sum(humidity)//len(humidity) if humidity else 'N/A'}%")
                    
                    print("\n   💧 Precipitation & Rainfall:")
                    precip = hourly_data.get('precipitation', [])
                    rain = hourly_data.get('rain', [])
                    total_precip = sum(precip) if precip else 0
                    total_rain = sum(rain) if rain else 0
                    print(f"      Total Precipitation (24h): {total_precip} {hourly_units.get('precipitation', 'mm')}")
                    print(f"      Total Rain (24h): {total_rain} {hourly_units.get('rain', 'mm')}")
                    print(f"      Max Hourly Precipitation: {max(precip) if precip else 'N/A'} mm")
                    
                    print("\n   🌪️ Wind Conditions:")
                    wind_speed = hourly_data.get('wind_speed_10m', [])
                    wind_dir = hourly_data.get('wind_direction_10m', [])
                    print(f"      Max Wind Speed: {max(wind_speed) if wind_speed else 'N/A'} {hourly_units.get('wind_speed_10m', 'km/h')}")
                    print(f"      Avg Wind Speed: {sum(wind_speed)//len(wind_speed) if wind_speed else 'N/A'} {hourly_units.get('wind_speed_10m', 'km/h')}")
                    
                    print("\n   🌱 Soil Moisture:")
                    soil_0_10 = hourly_data.get('soil_moisture_0_to_10cm', [])
                    soil_10_35 = hourly_data.get('soil_moisture_10_to_35cm', [])
                    valid_soil_0_10 = [x for x in soil_0_10 if x is not None]
                    print(f"      Surface Soil (0-10cm): {valid_soil_0_10[0] if valid_soil_0_10 else 'N/A'} {hourly_units.get('soil_moisture_0_to_10cm', 'm³/m³')}")
                    if soil_10_35 and any(soil_10_35):
                        valid_soil_10_35 = [x for x in soil_10_35 if x is not None]
                        print(f"      Deep Soil (10-35cm): {valid_soil_10_35[0] if valid_soil_10_35 else 'N/A'} {hourly_units.get('soil_moisture_10_to_35cm', 'm³/m³')}")
                    
                    print("\n   🔽 Atmospheric Pressure & Cloud Cover:")
                    pressure = hourly_data.get('surface_pressure', [])
                    cloud_cover = hourly_data.get('cloud_cover', [])
                    print(f"      Avg Pressure: {sum(pressure)//len(pressure) if pressure else 'N/A'} {hourly_units.get('surface_pressure', 'hPa')}")
                    print(f"      Max Cloud Cover: {max(cloud_cover) if cloud_cover else 'N/A'}%")
    else:
        print("No gauging station found")

    print("\n" + "=" * 60)
