/**
 * geocode.js — Reverse geocoding service with in-memory cache.
 *
 * Converts GPS coordinates to a place name + district using Nominatim.
 * Results are cached by coordinate rounded to 4 decimals (~11 m) to
 * avoid repeated external calls for the same location.
 */
import logger from '../../utils/logger.js';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map();

function cacheKey(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

/**
 * Reverse-geocode lat/lon to { name, district }.
 * Returns null on failure so callers can fall back gracefully.
 */
export async function reverseGeocode(lat, lon) {
  if (lat == null || lon == null) return null;

  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;

  const attempts = [
    { zoom: 14, label: 'standard' },
    { zoom: 10, label: 'wider' },
  ];

  for (const { zoom, label } of attempts) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=${zoom}`,
        { signal: AbortSignal.timeout(10000), headers: { 'Accept-Language': 'en', 'User-Agent': 'SmartCampBox/1.0 (research-iot)' } }
      );
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);

      const data = await res.json();
      const addr = data.address || {};
      const name = addr.village || addr.town || addr.city || addr.hamlet || addr.suburb || addr.county || '';
      const district = addr.district || addr.state_district || addr.state || '';

      if (name) {
        const value = { name, district };
        cache.set(key, { value, ts: Date.now() });
        return value;
      }
      // If no name found at this zoom, try wider zoom
    } catch (err) {
      logger.warn(`[Geocode] ${label} attempt failed: ${err.message}`);
    }
  }

  logger.warn(`[Geocode] All attempts failed for ${lat}, ${lon}`);
  return null;
}
