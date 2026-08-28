import json
import time

import requests

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)

REQUEST_HEADERS = {"User-Agent": "SmartCamp/1.0 (research-iot)"}


def query_overpass(query: str, timeout_s: int = 20, retries_per_endpoint: int = 1):
    """Query Overpass via POST with retry and cooldown for rate-limiting.

    Uses the `requests` library which handles connection timeouts reliably,
    unlike `urllib` which can block indefinitely on unreachable hosts.
    """
    last_error = None

    for endpoint in OVERPASS_ENDPOINTS:
        for attempt in range(retries_per_endpoint):
            try:
                response = requests.post(
                    endpoint,
                    data={"data": query},
                    headers=REQUEST_HEADERS,
                    timeout=(5, timeout_s),  # (connect_timeout, read_timeout)
                )

                if response.status_code >= 400:
                    last_error = {
                        "error": f"Overpass request failed with status {response.status_code}.",
                        "status": response.status_code,
                        "endpoint": endpoint,
                    }
                    if response.status_code == 429:
                        time.sleep(5 * (attempt + 1))
                    continue

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

            except requests.exceptions.ConnectionError as exc:
                last_error = {
                    "error": f"Connection failed: {exc}",
                    "endpoint": endpoint,
                    "attempt": attempt + 1,
                }
                if attempt < retries_per_endpoint - 1:
                    time.sleep(2)
                    continue
                break
            except requests.exceptions.Timeout as exc:
                last_error = {
                    "error": f"Request timed out after {timeout_s}s: {exc}",
                    "endpoint": endpoint,
                    "attempt": attempt + 1,
                }
                if attempt < retries_per_endpoint - 1:
                    time.sleep(2)
                    continue
                break
            except requests.exceptions.RequestException as exc:
                last_error = {
                    "error": f"Request failed: {exc}",
                    "endpoint": endpoint,
                    "attempt": attempt + 1,
                }
                break
            except ValueError as exc:
                last_error = {
                    "error": f"Failed to parse JSON: {exc}",
                    "endpoint": endpoint,
                }
                break

    return None, last_error or {"error": "Unknown Overpass error."}
