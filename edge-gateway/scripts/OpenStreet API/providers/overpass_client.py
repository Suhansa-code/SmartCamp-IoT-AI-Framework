import time

import requests

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)

REQUEST_HEADERS = {"User-Agent": "OpenStreet-API-Script/1.0"}


def query_overpass(query: str, timeout_s: int = 90, retries_per_endpoint: int = 2):
    """Query Overpass with endpoint fallback and simple retry for transient failures."""
    last_error = None

    for endpoint in OVERPASS_ENDPOINTS:
        for attempt in range(retries_per_endpoint):
            try:
                response = requests.get(
                    endpoint,
                    params={"data": query},
                    headers=REQUEST_HEADERS,
                    timeout=timeout_s,
                )
                response.raise_for_status()

                content_type = response.headers.get("Content-Type", "")
                if "json" not in content_type.lower():
                    last_error = {
                        "error": "Overpass response was not JSON.",
                        "status": response.status_code,
                        "content_type": content_type,
                        "body_preview": response.text[:500],
                        "endpoint": endpoint,
                    }
                    break

                return response.json(), None

            except requests.exceptions.RequestException as exc:
                last_error = {
                    "error": f"Request failed: {exc}",
                    "endpoint": endpoint,
                    "attempt": attempt + 1,
                }
                if attempt < retries_per_endpoint - 1:
                    # Small backoff for temporary overload/rate-limit spikes.
                    time.sleep(1.5 * (attempt + 1))
                    continue
                break
            except ValueError as exc:
                last_error = {
                    "error": f"Failed to parse JSON: {exc}",
                    "endpoint": endpoint,
                }
                break

    return None, last_error or {"error": "Unknown Overpass error."}
