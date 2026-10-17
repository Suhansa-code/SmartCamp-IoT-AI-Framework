/**
 * The one place the frontend decides where the API lives.
 *
 * This used to be spread across five different variable names, read inline in
 * a dozen components:
 *
 *   NEXT_PUBLIC_API_URL                 set by the Dockerfile
 *   NEXT_PUBLIC_DISASTER_API_BASE_URL   set by the Dockerfile
 *   NEXT_PUBLIC_DISASTER_API_URL        never set anywhere
 *   NEXT_PUBLIC_API_BASE_URL            never set anywhere
 *   (bare fallback)                     http://localhost:3002 — nothing listens there
 *
 * The two that are never set silently fell through to localhost:3002, which
 * resolves to the *visitor's own machine*. Those calls fail in the browser with
 * the deployment looking perfectly healthy from the server side, which is why
 * the notifications and alert panels came up empty on the VM but worked on a
 * workstation that happened to have something on 3002.
 *
 * ── Why the default is the empty string ─────────────────────────────────────
 *
 * nginx already fronts both services on one origin: `/api/` goes to the
 * backend, everything else to Next. So a *relative* `/api/...` is correct in
 * every environment — localhost, 54.91.43.141, 34.192.205.77, a future
 * domain — and stays correct when the VM's public IP changes.
 *
 * That matters because NEXT_PUBLIC_* is inlined into the client bundle at
 * BUILD time. Baking an IP in means the image is only valid for that IP: the
 * committed cloud-platform/.env still pointed at 54.91.43.141 after the VM
 * moved to 34.192.205.77, so every fetch from the deployed UI went to a host
 * that is no longer ours. Same-origin has no value to go stale, and the same
 * image now runs unmodified in every environment.
 *
 * Set NEXT_PUBLIC_API_URL only to override that — running `next dev` on :3000
 * with no nginx in front, where the API is a separate origin on :3001.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * The disaster pages were given their own variable that was never unified with
 * the main one, though both hit /api/* on the same backend. Kept as an
 * override for the one case that could ever need it — the disaster API living
 * somewhere else — and otherwise identical to API_BASE.
 */
export const DISASTER_API_BASE =
  process.env.NEXT_PUBLIC_DISASTER_API_BASE_URL || API_BASE;

/**
 * Join a path onto a query string without guessing at the separator.
 *
 * `${API}/api/resources/distributions${campParam}&page=0` produced
 * `/api/resources/distributions&page=0` whenever campParam was empty — no `?`
 * at all, so the whole thing was read as a path segment and the backend
 * answered 404. Those 404s are still in the VM's access log, several per
 * refresh of the distribution page.
 */
export function withQuery(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.set(key, String(value));
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}
