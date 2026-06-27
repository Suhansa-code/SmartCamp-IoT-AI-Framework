import requests

FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast"
REQUEST_HEADERS = {"User-Agent": "OpenStreet-API-Script/1.0"}


def fetch_forecast_location(latitude: float, longitude: float, timeout_s: int = 20):
    """Fetch weather forecast metadata including flood-relevant parameters and return resolved forecast location coordinates."""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "rain",
            "weather_code",
            "wind_speed_10m",
            "wind_direction_10m",
            "soil_moisture_0_to_10cm",
            "soil_moisture_10_to_35cm",
            "surface_pressure",
            "cloud_cover",
        ],
        "forecast_days": 1,
    }

    try:
        response = requests.get(
            FORECAST_ENDPOINT,
            params=params,
            headers=REQUEST_HEADERS,
            timeout=timeout_s,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.exceptions.RequestException as exc:
        return None, {"error": f"Forecast API request failed: {exc}"}
    except ValueError as exc:
        return None, {"error": f"Invalid JSON from forecast API: {exc}"}

    resolved_lat = payload.get("latitude")
    resolved_lon = payload.get("longitude")

    if resolved_lat is None or resolved_lon is None:
        return None, {
            "error": "Forecast API response did not include location coordinates.",
            "payload_preview": str(payload)[:500],
        }

    result = {
        "requested": {
            "lat": float(latitude),
            "lon": float(longitude),
        },
        "forecast_location": {
            "lat": float(resolved_lat),
            "lon": float(resolved_lon),
            "elevation": payload.get("elevation"),
            "timezone": payload.get("timezone"),
            "timezone_abbreviation": payload.get("timezone_abbreviation"),
        },
        "source": "open-meteo",
        "weather_forecast_parameters": {
            "hourly": payload.get("hourly", {}),
            "hourly_units": payload.get("hourly_units", {}),
        },
    }

    return result, None


if __name__ == "__main__":
    sample_lat = 7.507
    sample_lon = 80.945

    data, error = fetch_forecast_location(sample_lat, sample_lon)
    if error:
        print(error)
    else:
        print(data)
