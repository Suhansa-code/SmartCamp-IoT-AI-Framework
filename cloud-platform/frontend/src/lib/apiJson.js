/**
 * Defensive JSON reader for API responses.
 *
 * When the API behind the proxy is unreachable, the error the browser gets is
 * not JSON — it is a plain-text/HTML "Internal Server Error" body. Calling
 * `.json()` on that throws `Unexpected token 'I', "Internal S"...` and the real
 * problem (backend down) never reaches the user. Reading the content type
 * first turns it into a message the UI can actually show.
 *
 * Returns `{}` for a non-JSON 2xx (nothing useful to parse, caller falls back
 * to its own default) and `{ error: ... }` for non-JSON failures.
 */
export async function readJson(res) {
  const type = res.headers.get('content-type') || '';
  if (type.includes('json')) {
    return res.json().catch(() => ({ error: `Malformed response (HTTP ${res.status})` }));
  }
  if (res.ok) return {};
  return {
    error: res.status >= 500
      ? `Service unavailable (HTTP ${res.status}). Please try again shortly.`
      : `Request failed (HTTP ${res.status})`,
  };
}
