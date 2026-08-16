import json
import time
from urllib import error, parse, request

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)

REQUEST_HEADERS = {"User-Agent": "SmartCamp/1.0"}


def query_overpass(query: str, timeout_s: int = 30, retries_per_endpoint: int = 2):
    """Query Overpass via POST with retry and cooldown for rate-limiting."""
    last_error = None

    for endpoint in OVERPASS_ENDPOINTS:
        for attempt in range(retries_per_endpoint):
            try:
                data = parse.urlencode({"data": query}).encode()
                req = request.Request(endpoint, data=data, headers=REQUEST_HEADERS, method="POST")
                with request.urlopen(req, timeout=timeout_s) as response:
                    status = response.status
                    content_type = response.headers.get("Content-Type", "")
                    body = response.read().decode("utf-8", errors="replace")

                if status >= 400:
                    last_error = {
                        "error": f"Overpass request failed with status {status}.",
                        "status": status,
                        "endpoint": endpoint,
                    }
                    if status == 429:
                        time.sleep(5 * (attempt + 1))
                    continue

                if "json" not in content_type.lower():
                    last_error = {
                        "error": "Overpass response was not JSON.",
                        "status": status,
                        "content_type": content_type,
                        "body_preview": body[:500],
                        "endpoint": endpoint,
                    }
                    break

                return json.loads(body), None

            except error.URLError as exc:
                last_error = {
                    "error": f"Request failed: {exc}",
                    "endpoint": endpoint,
                    "attempt": attempt + 1,
                }
                if attempt < retries_per_endpoint - 1:
                    time.sleep(3 * (attempt + 1))
                    continue
                break
            except ValueError as exc:
                last_error = {
                    "error": f"Failed to parse JSON: {exc}",
                    "endpoint": endpoint,
                }
                break

    return None, last_error or {"error": "Unknown Overpass error."}
