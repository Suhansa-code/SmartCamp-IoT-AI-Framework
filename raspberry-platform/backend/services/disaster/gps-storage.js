/**
 * gps-storage.js — Persists GPS readings into disaster.db gps_readings table.
 *
 * Uses the existing gps.js service for fetching location data and disasterDb
 * from config/database.js for persistence. Implements a hybrid approach:
 *
 *   - Periodic storage every N minutes (configurable, default 30).
 *     Timer resets after each successful save so the next save occurs
 *     N minutes after the last successful persistence.
 *   - Movement-based storage when device moves ≥ threshold meters (Haversine).
 *     Saves instantly between intervals when movement is detected.
 *   - GPS recovery: If GPS was unavailable when the interval expired,
 *     immediately saves when valid GPS becomes available again.
 *
 * GPS data rules:
 *   - Only saves data with source=GPS_SENSOR (real GPS data).
 *   - Never saves mock/unavailable data.
 *
 * Does NOT add MQTT logic — newly inserted records have synced = 0 so the
 * existing disaster MQTT sync system picks them up automatically.
 */
import { disasterDb } from '../../config/database.js';
import { getGpsLocation, getLastKnownLocation } from './gps.js';
import { reverseGeocode } from './geocode.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nowISO } from '../../utils/helpers.js';
import { EventEmitter } from 'events';

const DEVICE_ID = C.DEVICE_ID;

// ── GPS change event emitter ────────────────────────────────────────────
// Other services (water-level, hydrospatial, weather) can listen for
// 'gps-changed' to trigger immediate re-fetch when GPS moves significantly.
export const gpsChangeEmitter = new EventEmitter();
gpsChangeEmitter.setMaxListeners(10);

// ── Config ──────────────────────────────────────────────────────────────

const INTERVAL_MS = (C.GPS_STORAGE_INTERVAL_MINUTES || 30) * 60_000;
const MOVEMENT_THRESHOLD_M = C.GPS_MOVEMENT_THRESHOLD_METERS || 100;

// ── State ───────────────────────────────────────────────────────────────

let timer = null;
let lastStoredLat = null;
let lastStoredLng = null;
let lastSaveTime = null;
let missedInterval = false; // true when timer fired but GPS was unavailable

// ── Prepared statements (lazy init) ─────────────────────────────────────

let insertStmt = null;

function ensureStatements() {
  if (insertStmt) return;
  insertStmt = disasterDb.prepare(`
    INSERT INTO gps_readings (device_id, latitude, longitude, altitude, accuracy, source, location_name, location_district, recorded_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
}

// ── Haversine distance ──────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Core storage logic ──────────────────────────────────────────────────

function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Insert a GPS reading into the database.
 * Returns true if inserted, false otherwise.
 */
function insertGpsRecord(lat, lng, altitude, accuracy, source, locationName, locationDistrict) {
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;
  const now = nowISO();
  insertStmt.run(DEVICE_ID, roundedLat, roundedLng, altitude ?? null, accuracy ?? null, source, locationName ?? null, locationDistrict ?? null, now);
  lastStoredLat = roundedLat;
  lastStoredLng = roundedLng;
  lastSaveTime = Date.now();
  logger.info(`[GPS-STORAGE] Stored reading: ${roundedLat.toFixed(4)}, ${roundedLng.toFixed(4)} @ ${now} — name="${locationName}", district="${locationDistrict}"`);

  // Emit GPS change event so other services can re-fetch immediately
  gpsChangeEmitter.emit('gps-changed', { latitude: roundedLat, longitude: roundedLng, altitude, accuracy, locationName, locationDistrict });

  return true;
}

/**
 * Attempt to store the current GPS location.
 * @param {boolean} isTimerTick - true when called from periodic timer
 * @returns {boolean} true if a record was inserted, false otherwise.
 */
export async function storeCurrentLocation(isTimerTick = false) {
  ensureStatements();

  let gps;
  try {
    gps = await getGpsLocation();
  } catch (err) {
    logger.warn(`[GPS-STORAGE] Fetch failed: ${err.message}`);
    if (isTimerTick) missedInterval = true;
    return false;
  }

  const { latitude: lat, longitude: lng, altitude, accuracy, source, location_name, district } = gps ?? {};

  logger.debug(`[GPS-STORAGE] GPS data: lat=${lat}, lng=${lng}, source=${source}, location="${location_name}", district="${district}", isTimerTick=${isTimerTick}`);

  // If location_name is empty or looks like raw coordinates, try geocoding
  let resolvedName = location_name || '';
  let resolvedDistrict = district || '';
  const looksLikeCoords = /^-?\d+\.?\d*\s*[, ]\s*-?\d+\.?\d*$/.test(resolvedName);

  if ((!resolvedName || looksLikeCoords) && isValidCoord(lat, lng)) {
    logger.info('[GPS-STORAGE] Location name missing or looks like coords — attempting geocoding');
    try {
      const geo = await reverseGeocode(lat, lng);
      if (geo) {
        if (geo.name) resolvedName = geo.name;
        if (geo.district) resolvedDistrict = geo.district;
        logger.info(`[GPS-STORAGE] Geocoded: name="${resolvedName}", district="${resolvedDistrict}"`);
      }
    } catch (err) {
      logger.warn(`[GPS-STORAGE] Geocoding failed: ${err.message}`);
    }
  }

  if (!isValidCoord(lat, lng)) {
    logger.info('[GPS-STORAGE] No valid GPS fix — skipping');
    if (isTimerTick) missedInterval = true;
    return false;
  }

  // Only save actual GPS_SENSOR data
  if (source !== 'GPS_SENSOR') {
    logger.info(`[GPS-STORAGE] Source is "${source}" — skipping (only GPS_SENSOR is saved)`);
    if (isTimerTick) missedInterval = true;
    return false;
  }

  // GPS is available — check if we missed an interval
  if (missedInterval) {
    logger.info('[GPS-STORAGE] GPS recovered after missed interval — saving immediately');
    logger.info(`[GPS-STORAGE] Saving: name="${resolvedName}", district="${resolvedDistrict}"`);
    missedInterval = false;
    try {
      return insertGpsRecord(lat, lng, altitude, accuracy, source, resolvedName, resolvedDistrict);
    } catch (err) {
      logger.error(`[GPS-STORAGE] Insert failed: ${err.message}`);
      return false;
    }
  }

  // Movement check: only apply for movement-triggered saves (not timer ticks)
  if (!isTimerTick && lastStoredLat != null && lastStoredLng != null) {
    const dist = haversineDistance(lastStoredLat, lastStoredLng, lat, lng);
    if (dist < MOVEMENT_THRESHOLD_M) {
      logger.debug(`[GPS-STORAGE] Moved ${Math.round(dist)}m — below ${MOVEMENT_THRESHOLD_M}m threshold`);
      return false;
    }
    logger.info(`[GPS-STORAGE] Movement detected: ${Math.round(dist)}m — storing new reading`);
  }

  logger.info(`[GPS-STORAGE] Saving: name="${resolvedName}", district="${resolvedDistrict}"`);
  try {
    return insertGpsRecord(lat, lng, altitude, accuracy, source, resolvedName, resolvedDistrict);
  } catch (err) {
    logger.error(`[GPS-STORAGE] Insert failed: ${err.message}`);
    return false;
  }
}

// ── Periodic timer (resets after each successful save) ──────────────────

function scheduleNextTick() {
  timer = setTimeout(async () => {
    logger.info(`[GPS-STORAGE] Timer tick fired — interval: ${INTERVAL_MS}ms (${INTERVAL_MS / 60_000} min)`);
    try {
      const saved = await storeCurrentLocation(true);
      if (saved) {
        logger.info(`[GPS-STORAGE] Save successful — next save in ${INTERVAL_MS / 60_000} minutes`);
      } else {
        logger.debug(`[GPS-STORAGE] No save this tick — retrying in ${INTERVAL_MS / 60_000} minutes`);
      }
    } catch (err) {
      logger.error(`[GPS-STORAGE] Tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, INTERVAL_MS);
}

export function startGpsStorage(intervalMs = INTERVAL_MS) {
  if (timer) {
    logger.warn('[GPS-STORAGE] Already running');
    return;
  }

  ensureStatements();

  // Seed lastStored from the most recent gps_readings row
  try {
    const last = disasterDb
      .prepare('SELECT latitude, longitude FROM gps_readings ORDER BY id DESC LIMIT 1')
      .get();
    if (last) {
      lastStoredLat = last.latitude;
      lastStoredLng = last.longitude;
      logger.info(`[GPS-STORAGE] Seeded last location from DB: ${lastStoredLat}, ${lastStoredLng}`);
    }
  } catch (_) { /* table may be empty */ }

  // First tick after a short delay, then schedule subsequent ticks
  setTimeout(async () => {
    logger.info(`[GPS-STORAGE] Initial tick — calling storeCurrentLocation(true)`);
    const saved = await storeCurrentLocation(true).catch((err) => {
      logger.error(`[GPS-STORAGE] Initial tick error: ${err.message}`);
      return false;
    });
    logger.info(`[GPS-STORAGE] Initial tick result: ${saved ? 'saved' : 'no save'}`);
    scheduleNextTick();
  }, 2000);

  logger.info(
    `[GPS-STORAGE] Started (interval: ${intervalMs}ms = ${intervalMs / 60_000} min, threshold: ${MOVEMENT_THRESHOLD_M}m)`
  );
}

export function stopGpsStorage() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('[GPS-STORAGE] Stopped');
}

export function getGpsStorageStatus() {
  return {
    running: !!timer,
    interval_ms: INTERVAL_MS,
    interval_minutes: INTERVAL_MS / 60_000,
    movement_threshold_m: MOVEMENT_THRESHOLD_M,
    last_stored: lastStoredLat != null ? { latitude: lastStoredLat, longitude: lastStoredLng } : null,
    last_save_time: lastSaveTime ? new Date(lastSaveTime).toISOString() : null,
    missed_interval: missedInterval,
  };
}
