/**
 * gps-storage.js — Persists GPS readings into disaster.db gps_readings table.
 *
 * Uses the existing gps.js service for fetching location data and disasterDb
 * from config/database.js for persistence. Implements a hybrid approach:
 *
 *   - Periodic storage every N minutes (configurable, default 30).
 *   - Movement-based storage when device moves ≥ threshold meters (Haversine).
 *
 * Does NOT add MQTT logic — newly inserted records have synced = 0 so the
 * existing disaster MQTT sync system picks them up automatically.
 */
import { disasterDb } from '../../config/database.js';
import { getGpsLocation, getLastKnownLocation } from './gps.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';

const DEVICE_ID = C.DEVICE_ID;

// ── Config ──────────────────────────────────────────────────────────────

const INTERVAL_MS = (C.GPS_STORAGE_INTERVAL_MINUTES || 30) * 60_000;
const MOVEMENT_THRESHOLD_M = C.GPS_MOVEMENT_THRESHOLD_METERS || 100;

// ── State ───────────────────────────────────────────────────────────────

let timer = null;
let lastStoredLat = null;
let lastStoredLng = null;

// ── Prepared statements (lazy init) ─────────────────────────────────────

let insertStmt = null;

function ensureStatements() {
  if (insertStmt) return;
  insertStmt = disasterDb.prepare(`
    INSERT INTO gps_readings (device_id, latitude, longitude, altitude, accuracy, source, recorded_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
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
 * Attempt to store the current GPS location.
 * Returns true if a record was inserted, false otherwise.
 */
export async function storeCurrentLocation() {
  ensureStatements();

  let gps;
  try {
    gps = await getGpsLocation();
  } catch (err) {
    logger.warn(`[GPS-STORAGE] Fetch failed: ${err.message}`);
    return false;
  }

  const { latitude: lat, longitude: lng, altitude, accuracy, source } = gps ?? {};

  if (!isValidCoord(lat, lng)) {
    logger.debug('[GPS-STORAGE] No valid fix — skipping');
    return false;
  }

  const now = new Date().toISOString();

  // Movement check: skip if within threshold of last stored location
  if (lastStoredLat != null && lastStoredLng != null) {
    const dist = haversineDistance(lastStoredLat, lastStoredLng, lat, lng);
    if (dist < MOVEMENT_THRESHOLD_M) {
      logger.debug(`[GPS-STORAGE] Moved ${Math.round(dist)}m — below ${MOVEMENT_THRESHOLD_M}m threshold`);
      return false;
    }
    logger.info(`[GPS-STORAGE] Movement detected: ${Math.round(dist)}m — storing new reading`);
  }

  try {
    insertStmt.run(DEVICE_ID, lat, lng, altitude ?? null, accuracy ?? null, source || 'GPS_SENSOR', now);
    lastStoredLat = lat;
    lastStoredLng = lng;
    logger.info(`[GPS-STORAGE] Stored reading: ${lat.toFixed(6)}, ${lng.toFixed(6)} @ ${now}`);
    return true;
  } catch (err) {
    logger.error(`[GPS-STORAGE] Insert failed: ${err.message}`);
    return false;
  }
}

// ── Periodic timer ──────────────────────────────────────────────────────

function tick() {
  storeCurrentLocation().catch((err) => {
    logger.error(`[GPS-STORAGE] Tick error: ${err.message}`);
  });
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

  // First tick after a short delay, then periodic
  setTimeout(() => {
    tick();
    timer = setInterval(tick, intervalMs);
  }, 2000);

  logger.info(
    `[GPS-STORAGE] Started (interval: ${intervalMs}ms, threshold: ${MOVEMENT_THRESHOLD_M}m)`
  );
}

export function stopGpsStorage() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  logger.info('[GPS-STORAGE] Stopped');
}

export function getGpsStorageStatus() {
  return {
    running: !!timer,
    interval_ms: INTERVAL_MS,
    movement_threshold_m: MOVEMENT_THRESHOLD_M,
    last_stored: lastStoredLat != null ? { latitude: lastStoredLat, longitude: lastStoredLng } : null,
  };
}
