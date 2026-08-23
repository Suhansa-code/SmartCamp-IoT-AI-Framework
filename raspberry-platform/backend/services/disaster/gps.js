/**
 * gps.js — GPS location service for the Raspberry Pi backend.
 *
 * Fetches GPS data from the Edge Gateway GPS API (single source of truth).
 * The Edge Gateway handles the serial GPS read, fallback to mock location,
 * and reverse geocoding. This service caches the result for 5 seconds.
 */
import logger from '../../utils/logger.js';

const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';
const CACHE_MS = 5000;

let lastFix = null;
let lastFetch = 0;

async function fetchFromEdge() {
  const res = await fetch(`${EDGE_API}/api/gps`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Edge Gateway returned ${res.status}`);
  return res.json();
}

function buildFallback() {
  return {
    latitude: null,
    longitude: null,
    altitude: null,
    satellites: 0,
    location_name: null,
    gps_status: 'UNAVAILABLE',
    is_mock: false,
    source: 'UNAVAILABLE',
    live: false,
    fetched_at: new Date().toISOString(),
  };
}

export async function getGpsLocation() {
  if (lastFix && (Date.now() - lastFetch) < CACHE_MS) return lastFix;

  try {
    const data = await fetchFromEdge();
    const live = data.latitude != null && data.longitude != null && data.gps_status === 'ACTIVE';
    lastFix = { ...data, live, fetched_at: new Date().toISOString() };
    lastFetch = Date.now();
    return lastFix;
  } catch (err) {
    logger.warn(`[GPS] Edge Gateway fetch failed: ${err.message}`);
    const fallback = buildFallback();
    lastFix = fallback;
    lastFetch = Date.now();
    return fallback;
  }
}

export function getLastKnownLocation() {
  return lastFix || buildFallback();
}
