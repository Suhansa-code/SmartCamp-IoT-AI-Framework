/**
 * gps.js — GPS location service for the Raspberry Pi backend.
 *
 * Fetches GPS data from the Edge Gateway GPS API (single source of truth).
 * The Edge Gateway handles the serial GPS read.
 * This service caches the result for 5 seconds.
 *
 * When GPS is unavailable, returns null coordinates with source=UNAVAILABLE.
 * No mock data is ever returned.
 */
import logger from '../../utils/logger.js';
import { getCampId } from '../../config/camp-id.js';
import { reverseGeocode } from './geocode.js';

const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';
const CACHE_MS = 5000;

let lastFix = null;
let lastFetch = 0;

/* ------------------------------------------------------------------ */
/*  CAMP ID                                                            */
/* ------------------------------------------------------------------ */

export function getDynamicCampId() {
  return getCampId();
}

/* ------------------------------------------------------------------ */
/*  EDGE GATEWAY FETCH                                                 */
/* ------------------------------------------------------------------ */

async function fetchFromEdge() {
  const res = await fetch(`${EDGE_API}/api/gps`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Edge Gateway returned ${res.status}`);
  return res.json();
}

function buildUnavailable() {
  return {
    latitude: null,
    longitude: null,
    altitude: null,
    satellites: 0,
    location_name: null,
    district: null,
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

    // If GPS unavailable, return without caching stale data
    if (!live) {
      const unavailable = buildUnavailable();
      unavailable.camp_id = getDynamicCampId();
      return unavailable;
    }

    let locationName = data.location_name || '';
    let district = data.district || '';
    const looksLikeCoords = /^-?\d+\.?\d*\s*[, ]\s*-?\d+\.?\d*$/.test(locationName);

    // Always try Pi-side geocoding — it's more reliable (zoom 14 + retry at zoom 10)
    // and takes priority over Edge Gateway result
    if (data.latitude != null && data.longitude != null) {
      const geo = await reverseGeocode(data.latitude, data.longitude);
      if (geo) {
        if (geo.name) locationName = geo.name;
        if (geo.district) district = geo.district;
      }
    }

    // If still no name or looks like coords, use Edge Gateway fallback then coordinates
    if (!locationName || looksLikeCoords) {
      locationName = `${data.latitude}, ${data.longitude}`;
    }

    lastFix = {
      ...data,
      location_name: locationName || null,
      district: district || null,
      live,
      camp_id: getDynamicCampId(),
      fetched_at: new Date().toISOString(),
    };
    lastFetch = Date.now();
    return lastFix;
  } catch (err) {
    logger.warn(`[GPS] Edge Gateway fetch failed: ${err.message}`);
    const unavailable = buildUnavailable();
    unavailable.camp_id = getDynamicCampId();
    lastFix = unavailable;
    lastFetch = Date.now();
    return unavailable;
  }
}

export function getLastKnownLocation() {
  return lastFix || buildUnavailable();
}
