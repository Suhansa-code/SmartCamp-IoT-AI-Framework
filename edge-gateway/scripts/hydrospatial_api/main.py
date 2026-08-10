import argparse
import json
import os
import sys
from gps_module.gps_reader import GPSReader
from providers.river_lookup import get_nearest_named_river
from service import find_nearest_gauging_station_detailed
from providers.live_water_level_api import get_latest_gauge_data
from providers.weather_forecast_location import fetch_forecast_location

DEFAULT_LATITUDE = 7.507
DEFAULT_LONGITUDE = 80.945
DEFAULT_ALTITUDE = 10.0


def _safe_average(values):
    cleaned = [value for value in values if value is not None]
    if not cleaned:
        return None
    return sum(cleaned) / len(cleaned)


def _summarize_forecast(forecast_data):
    hourly = forecast_data.get('weather_forecast_parameters', {}).get('hourly', {})

    temperatures = hourly.get('temperature_2m', [])
    humidity = hourly.get('relative_humidity_2m', [])
    precipitation = hourly.get('precipitation', [])
    rain = hourly.get('rain', [])
    wind_speed = hourly.get('wind_speed_10m', [])
    soil_0_10 = hourly.get('soil_moisture_0_to_10cm', [])
    soil_10_35 = hourly.get('soil_moisture_10_to_35cm', [])
    pressure = hourly.get('surface_pressure', [])
    cloud_cover = hourly.get('cloud_cover', [])

    return {
        'min_temp': min(temperatures) if temperatures else None,
        'max_temp': max(temperatures) if temperatures else None,
        'avg_humidity': _safe_average(humidity),
        'total_precipitation': sum(precipitation) if precipitation else None,
        'total_rain': sum(rain) if rain else None,
        'max_hourly_precipitation': max(precipitation) if precipitation else None,
        'max_wind_speed': max(wind_speed) if wind_speed else None,
        'avg_wind_speed': _safe_average(wind_speed),
        'surface_soil_moisture': next((value for value in soil_0_10 if value is not None), None),
        'deep_soil_moisture': next((value for value in soil_10_35 if value is not None), None),
        'avg_pressure': _safe_average(pressure),
        'max_cloud_cover': max(cloud_cover) if cloud_cover else None,
    }


def build_live_payload(latitude, longitude, altitude):
    payload = {
        'query_location': {
            'lat': latitude,
            'lon': longitude,
            'alt': altitude,
        },
        'nearest_river': None,
        'gauging_station': None,
        'live_gauge_data': None,
        'forecast': None,
        'forecast_summary': None,
        'errors': {},
    }

    nearest_river, river_error = get_nearest_named_river(latitude, longitude)
    if river_error:
        payload['errors']['river_lookup'] = river_error
    else:
        payload['nearest_river'] = nearest_river

    detailed_result, detailed_error = find_nearest_gauging_station_detailed(latitude, longitude)
    if detailed_error:
        payload['errors']['gauging_station'] = detailed_error
    else:
        payload['gauging_station'] = detailed_result

    station_name = detailed_result.get('station_name') if detailed_result else ''
    if station_name:
        try:
            payload['live_gauge_data'] = get_latest_gauge_data(station_name, include_geometry=True)
        except Exception as exc:
            payload['errors']['live_gauge_data'] = str(exc)

    try:
        forecast_data, forecast_error = fetch_forecast_location(latitude, longitude)
        if forecast_error:
            payload['errors']['forecast'] = forecast_error
        else:
            payload['forecast'] = forecast_data
            payload['forecast_summary'] = _summarize_forecast(forecast_data)
    except Exception as exc:
        payload['errors']['forecast'] = {'error': str(exc)}

    return payload


def print_human(payload):
    print('=' * 60)
    print('SMART CAMP - WATER LEVEL MONITORING')
    print('=' * 60)
    location = payload['query_location']
    print(f"\nQuery Location: Lat {location['lat']}, Lon {location['lon']}, Alt {location['alt']}")
    print('-' * 60)

    river = payload.get('nearest_river')
    if river:
        print(f"Nearest water path name: {river.get('name', 'N/A')}")

    station = payload.get('gauging_station')
    if station:
        print(f"Nearest River (CSV): {station.get('river_name') or station.get('river', 'N/A')}")
        print('\n📍 GAUGING STATION DETAILS:')
        print(f"   Station Name: {station.get('station_name', 'N/A')}")
        print(f"   Station River: {station.get('river_name') or station.get('river', 'N/A')}")
        print(f"   Distance to Gauging Station: {station.get('distance_to_station_meters', station.get('distance_meters', 'N/A'))} meters")
        print(f"   Distance to Upstream River: {station.get('distance_to_river_meters', 'N/A')} meters")
        print(f"   Type: {station.get('type', 'N/A')}")

    gauge = payload.get('live_gauge_data')
    if gauge:
        print('\n💧 LIVE WATER LEVEL DATA:')
        print(f"   Current Water Level: {gauge.get('water_level', 'N/A')} m")
        print(f"   Rainfall: {gauge.get('rainfall', 'N/A')} mm")
        print(f"   Alert Level: {gauge.get('alert_level', 'N/A')} m")
        print(f"   Minor Flood Level: {gauge.get('minor_flood_level', 'N/A')} m")
        print(f"   Major Flood Level: {gauge.get('major_flood_level', 'N/A')} m")
        if gauge.get('latitude') and gauge.get('longitude'):
            print(f"   Gauge Location: Lat {gauge['latitude']:.4f}, Lon {gauge['longitude']:.4f}")

    forecast = payload.get('forecast')
    if forecast:
        print('\n🌤️ WEATHER FORECAST LOCATION:')
        forecast_location = forecast.get('forecast_location', {})
        print(f"   Forecast Location: Lat {forecast_location.get('lat')}, Lon {forecast_location.get('lon')}")
        print(f"   Elevation: {forecast_location.get('elevation', 'N/A')} m")


        summary = payload.get('forecast_summary', {})
        print('\n📊 HOURLY WEATHER FORECAST FOR FLOOD PREDICTION:')
        print(f"   Min Temp: {summary.get('min_temp', 'N/A')}°C, Max Temp: {summary.get('max_temp', 'N/A')}°C")
        print(f"   Avg Humidity: {summary.get('avg_humidity', 'N/A')}%")
        print(f"   Total Precipitation (24h): {summary.get('total_precipitation', 'N/A')} mm")
        print(f"   Total Rain (24h): {summary.get('total_rain', 'N/A')} mm")
        print(f"   Max Hourly Precipitation: {summary.get('max_hourly_precipitation', 'N/A')} mm")
        print(f"   Max Wind Speed: {summary.get('max_wind_speed', 'N/A')}")
        print(f"   Avg Wind Speed: {summary.get('avg_wind_speed', 'N/A')}")
        print(f"   Surface Soil (0-10cm): {summary.get('surface_soil_moisture', 'N/A')}")
        print(f"   Deep Soil (10-35cm): {summary.get('deep_soil_moisture', 'N/A')}")
        print(f"   Avg Pressure: {summary.get('avg_pressure', 'N/A')}")
        print(f"   Max Cloud Cover: {summary.get('max_cloud_cover', 'N/A')}%")

    if payload.get('errors'):
        print('\n⚠️ Some live lookups failed:')
        for key, error in payload['errors'].items():
            print(f"   {key}: {error}")

    print('\n' + '=' * 60)


def main():
    parser = argparse.ArgumentParser(description='Smart Camp OpenStreet live lookup')
    parser.add_argument('--lat', type=float, default=DEFAULT_LATITUDE)
    parser.add_argument('--lon', type=float, default=DEFAULT_LONGITUDE)
    parser.add_argument('--alt', type=float, default=DEFAULT_ALTITUDE)
    parser.add_argument('--json', action='store_true', help='Print JSON instead of human-readable output')

    # GPS mode
    parser.add_argument('--use-gps', action='store_true', help='Read latitude/longitude/altitude from GPSReader')
    parser.add_argument('--gps-port', type=str, default='COM7', help='Serial port for GPS (e.g., COM7)')
    parser.add_argument('--gps-baudrate', type=int, default=9600, help='Serial baudrate for GPS')

    args = parser.parse_args()

    if args.use_gps:
        gps = GPSReader(port=args.gps_port, baudrate=args.gps_baudrate).get_gps_data()
        latitude = float(gps['latitude'])
        longitude = float(gps['longitude'])
        altitude = float(gps['altitude'])
    else:
        latitude = args.lat
        longitude = args.lon
        altitude = args.alt



    payload = build_live_payload(latitude, longitude, altitude)

    if args.json:

        print(json.dumps(payload, ensure_ascii=True, default=str))
        return

    print_human(payload)


if __name__ == '__main__':
    main()
