/**
 * rainfall-storage.js — Persists rainfall sensor readings into disaster.db.
 *
 * Fetches rainfall data from the Edge Gateway /api/rainfall endpoint
 * every 15 minutes (configurable). Follows the same self-rescheduling
 * setTimeout pattern as gps-storage.js.
 *
 * Does NOT add MQTT logic — newly inserted records have synced = 0 so the
 * existing disaster MQTT sync system picks them up automatically.
 */
import { disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nowISO } from '../../utils/helpers.js';

const DEVICE_ID = C.DEVICE_ID;
const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

// ── Config ──────────────────────────────────────────────────────────────

const INTERVAL_MS = (C.RAINFALL_STORAGE_INTERVAL_MINUTES || 15) * 60_000;

// ── State ───────────────────────────────────────────────────────────────

let timer = null;
let lastSaveTime = null;

// ── Prepared statements (lazy init) ─────────────────────────────────────

let insertStmt = null;

function ensureStatements() {
  if (insertStmt) return;
  insertStmt = disasterDb.prepare(`
    INSERT INTO rainfall_readings
      (device_id, rain_analog, rain_digital, rain_status, wetness_level,
       wetness_value, latitude, longitude, recorded_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
}

// ── Helpers ─────────────────────────────────────────────────────────────

const WETNESS_LEVELS = { DRY: 0, LIGHT: 1, MODERATE: 2, HEAVY: 3 };

function getLatestPersistedGps() {
  try {
    const row = disasterDb
      .prepare('SELECT latitude, longitude FROM gps_readings ORDER BY id DESC LIMIT 1')
      .get();
    if (row && row.latitude != null && row.longitude != null) {
      return { latitude: row.latitude, longitude: row.longitude };
    }
  } catch (_) {}
  return null;
}

function getLatestRainfallRecord() {
  try {
    return disasterDb
      .prepare('SELECT * FROM rainfall_readings ORDER BY id DESC LIMIT 1')
      .get();
  } catch (_) {
    return null;
  }
}

/**
 * Fetch rainfall data from the Edge Gateway.
 * Returns { data, error }.
 */
async function fetchRainfallFromGateway() {
  try {
    const url = `${EDGE_API}/api/rainfall`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return { data: null, error: `Gateway returned ${response.status}` };
    }
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ── Core fetch + save logic ─────────────────────────────────────────────

export async function fetchAndSaveRainfall() {
  ensureStatements();

  const { data, error } = await fetchRainfallFromGateway();

  if (error || !data) {
    logger.warn(`[RAINFALL] Fetch from Edge Gateway failed: ${error || 'no data'}`);
    return false;
  }

  logger.info(`[RAINFALL] Fetched from gateway: status="${data.sensor_status}", analog=${data.rain_analog}, rain="${data.rain_status}"`);

  if (data.sensor_status !== 'ACTIVE') {
    logger.warn(`[RAINFALL] Sensor not active (status="${data.sensor_status}") — skipping save`);
    return false;
  }

  const gps = getLatestPersistedGps();
  const lat = gps?.latitude ?? null;
  const lng = gps?.longitude ?? null;
  const fetchedAt = nowISO();
  const wetnessVal = WETNESS_LEVELS[data.wetness_level] ?? 0;

  try {
    insertStmt.run(
      DEVICE_ID,
      data.rain_analog,
      data.rain_digital,
      data.rain_status,
      data.wetness_level,
      wetnessVal,
      lat,
      lng,
      fetchedAt,
    );

    lastSaveTime = Date.now();
    logger.info(`[RAINFALL] Saved: analog=${data.rain_analog}, status="${data.rain_status}", wetness="${data.wetness_level}"`);
    return true;
  } catch (err) {
    logger.error(`[RAINFALL] DB insert failed: ${err.message}`);
    return false;
  }
}

// ── Periodic timer (self-rescheduling) ─────────────────────────────────

function scheduleNextTick() {
  timer = setTimeout(async () => {
    logger.info(`[RAINFALL] Timer tick — interval: ${INTERVAL_MS}ms (${INTERVAL_MS / 60_000} min)`);
    try {
      const saved = await fetchAndSaveRainfall();
      if (saved) {
        logger.info(`[RAINFALL] Save successful — next fetch in ${INTERVAL_MS / 60_000} minutes`);
      } else {
        logger.debug('[RAINFALL] No save this tick — will retry next interval');
      }
    } catch (err) {
      logger.error(`[RAINFALL] Tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, INTERVAL_MS);
}

// ── Public API ──────────────────────────────────────────────────────────

export function startRainfallStorage() {
  if (timer) {
    logger.warn('[RAINFALL] Already running');
    return;
  }

  ensureStatements();

  // First tick after a short delay
  setTimeout(async () => {
    logger.info('[RAINFALL] Initial tick');
    try {
      const saved = await fetchAndSaveRainfall();
      logger.info(`[RAINFALL] Initial tick result: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[RAINFALL] Initial tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, 8_000);

  logger.info(`[RAINFALL] Started (interval: ${INTERVAL_MS}ms = ${INTERVAL_MS / 60_000} min)`);
}

export function stopRainfallStorage() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('[RAINFALL] Stopped');
}

export function getRainfallStorageStatus() {
  return {
    running: !!timer,
    interval_ms: INTERVAL_MS,
    interval_minutes: INTERVAL_MS / 60_000,
    last_save_time: lastSaveTime ? new Date(lastSaveTime).toISOString() : null,
  };
}

/**
 * Get the latest rainfall record from the database.
 * Used by the controller to serve the frontend.
 */
export function getLatestRainfall() {
  try {
    const row = disasterDb
      .prepare('SELECT * FROM rainfall_readings ORDER BY id DESC LIMIT 1')
      .get();
    if (!row) return null;
    return {
      id: row.id,
      device_id: row.device_id,
      rain_analog: row.rain_analog,
      rain_digital: row.rain_digital,
      rain_status: row.rain_status,
      wetness_level: row.wetness_level,
      wetness_value: row.wetness_value,
      latitude: row.latitude,
      longitude: row.longitude,
      recorded_at: row.recorded_at,
    };
  } catch (err) {
    logger.error(`[RAINFALL] getLatestRainfall failed: ${err.message}`);
    return null;
  }
}
