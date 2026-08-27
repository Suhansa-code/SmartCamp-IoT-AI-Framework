/**
 * sensor-status-storage.js — Persists sensor connectivity status into disaster.db.
 *
 * Every 10 minutes:
 *   1. Fetch /api/device-status from Edge Gateway
 *   2. Extract connected status for each sensor
 *   3. Save into sensor_status_readings
 */
import { disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nowISO } from '../../utils/helpers.js';

const DEVICE_ID = C.DEVICE_ID;
const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

const INTERVAL_MS = 10 * 60_000;

let timer = null;
let lastSaveTime = null;

let insertStmt = null;

function ensureStatements() {
  if (insertStmt) return;
  insertStmt = disasterDb.prepare(`
    INSERT INTO sensor_status_readings
      (device_id, gps_connected, temperature_connected, humidity_connected,
       rainfall_connected, gateway_status, recorded_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function fetchDeviceStatus() {
  try {
    const url = `${EDGE_API}/api/device-status`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
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

export async function fetchAndSaveSensorStatus() {
  ensureStatements();

  const { data, error } = await fetchDeviceStatus();
  if (error || !data) {
    logger.warn(`[SENSOR_STATUS] Fetch from Edge Gateway failed: ${error || 'no data'}`);
    return false;
  }

  const sensors = data.sensors || {};
  const gps = sensors.gps?.connected ? 1 : 0;
  const temp = sensors.temperature?.connected ? 1 : 0;
  const hum = sensors.humidity?.connected ? 1 : 0;
  const rain = sensors.rainfall?.connected ? 1 : 0;
  const gateway = data.device?.status || 'unknown';
  const now = nowISO();

  try {
    insertStmt.run(DEVICE_ID, gps, temp, hum, rain, gateway, now);
    lastSaveTime = Date.now();
    logger.info(`[SENSOR_STATUS] Saved: GPS=${gps ? 'OK' : 'DOWN'}, Temp=${temp ? 'OK' : 'DOWN'}, Hum=${hum ? 'OK' : 'DOWN'}, Rain=${rain ? 'OK' : 'DOWN'}, Gateway=${gateway}`);
    return true;
  } catch (err) {
    logger.error(`[SENSOR_STATUS] DB insert failed: ${err.message}`);
    return false;
  }
}

// ── Periodic timer ──────────────────────────────────────────────────────

function scheduleNextTick() {
  timer = setTimeout(async () => {
    logger.info('[SENSOR_STATUS] Timer tick');
    try {
      const saved = await fetchAndSaveSensorStatus();
      logger.info(`[SENSOR_STATUS] Tick result: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[SENSOR_STATUS] Tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, INTERVAL_MS);
}

// ── Public API ──────────────────────────────────────────────────────────

export function startSensorStatusStorage() {
  if (timer) {
    logger.warn('[SENSOR_STATUS] Already running');
    return;
  }

  ensureStatements();

  setTimeout(async () => {
    logger.info('[SENSOR_STATUS] Initial tick');
    try {
      const saved = await fetchAndSaveSensorStatus();
      logger.info(`[SENSOR_STATUS] Initial tick result: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[SENSOR_STATUS] Initial tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, 4_000);

  logger.info('[SENSOR_STATUS] Started (interval: 10 min)');
}

export function stopSensorStatusStorage() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('[SENSOR_STATUS] Stopped');
}

export function getSensorStatusStorageStatus() {
  return {
    running: !!timer,
    interval_ms: INTERVAL_MS,
    interval_minutes: INTERVAL_MS / 60_000,
    last_save_time: lastSaveTime ? new Date(lastSaveTime).toISOString() : null,
  };
}

/**
 * Get the latest sensor status record from the database.
 */
export function getLatestSensorStatus() {
  try {
    const row = disasterDb
      .prepare('SELECT * FROM sensor_status_readings ORDER BY id DESC LIMIT 1')
      .get();
    if (!row) return null;
    return {
      id: row.id,
      device_id: row.device_id,
      gps_connected: row.gps_connected,
      temperature_connected: row.temperature_connected,
      humidity_connected: row.humidity_connected,
      rainfall_connected: row.rainfall_connected,
      gateway_status: row.gateway_status,
      recorded_at: row.recorded_at,
    };
  } catch (err) {
    logger.error(`[SENSOR_STATUS] getLatestSensorStatus failed: ${err.message}`);
    return null;
  }
}

/**
 * Get recent sensor status history.
 */
export function getSensorStatusHistory(limit = 24) {
  try {
    return disasterDb
      .prepare('SELECT * FROM sensor_status_readings ORDER BY id DESC LIMIT ?')
      .all(limit);
  } catch (err) {
    logger.error(`[SENSOR_STATUS] getSensorStatusHistory failed: ${err.message}`);
    return [];
  }
}
