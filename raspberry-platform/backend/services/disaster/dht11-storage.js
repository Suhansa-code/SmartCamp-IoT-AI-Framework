/**
 * dht11-storage.js — Persists DHT11 (temperature + humidity) readings into disaster.db.
 *
 * Fetches DHT11 data from the Edge Gateway /api/dht11 endpoint
 * every 5 minutes (configurable). Self-rescheduling setTimeout pattern.
 */
import { disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nowISO } from '../../utils/helpers.js';
import { evaluateDht11Thresholds } from './alert-evaluator.js';

const DEVICE_ID = C.DEVICE_ID;
const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

// ── Config ──────────────────────────────────────────────────────────────

const INTERVAL_MS = (C.DHT11_STORAGE_INTERVAL_MINUTES || 5) * 60_000;

// ── State ───────────────────────────────────────────────────────────────

let timer = null;
let lastSaveTime = null;

// ── Prepared statements (lazy init) ─────────────────────────────────────

let insertStmt = null;

function ensureStatements() {
  if (insertStmt) return;
  insertStmt = disasterDb.prepare(`
    INSERT INTO HumidityTemp_readings
      (device_id, temperature, humidity, latitude, longitude, recorded_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);
}

// ── Helpers ─────────────────────────────────────────────────────────────

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

/**
 * Fetch DHT11 data from the Edge Gateway.
 * Returns { data, error }.
 */
async function fetchDht11FromGateway() {
  try {
    const url = `${EDGE_API}/api/dht11`;
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

export async function fetchAndSaveDht11() {
  ensureStatements();

  const { data, error } = await fetchDht11FromGateway();

  if (error || !data) {
    logger.warn(`[DHT11] Fetch from Edge Gateway failed: ${error || 'no data'}`);
    return false;
  }

  logger.info(`[DHT11] Fetched from gateway: status="${data.sensor_status}", temp=${data.temperature}, hum=${data.relative_humidity}`);

  if (data.sensor_status !== 'ACTIVE') {
    logger.warn(`[DHT11] Sensor not active (status="${data.sensor_status}") — skipping save`);
    return false;
  }

  const gps = getLatestPersistedGps();
  const lat = gps?.latitude ?? null;
  const lng = gps?.longitude ?? null;
  const fetchedAt = nowISO();

  try {
    insertStmt.run(
      DEVICE_ID,
      data.temperature,
      data.relative_humidity,
      lat,
      lng,
      fetchedAt,
    );

    lastSaveTime = Date.now();
    logger.info(`[DHT11] Saved: temp=${data.temperature}°C, humidity=${data.relative_humidity}%`);

    try {
      const alertResult = evaluateDht11Thresholds({ temperature: data.temperature, humidity: data.relative_humidity });
      if (alertResult.created) {
        logger.warn(`[DHT11] ALERT: ${alertResult.alert.alert_type} — ${alertResult.alert.title}`);
      } else if (alertResult.refreshed) {
        logger.info(`[DHT11] Alert refreshed: ${alertResult.alert.alert_type}`);
      }
    } catch (alertErr) {
      logger.error(`[DHT11] Alert evaluation failed: ${alertErr.message}`);
    }

    return true;
  } catch (err) {
    logger.error(`[DHT11] DB insert failed: ${err.message}`);
    return false;
  }
}

// ── Periodic timer (self-rescheduling) ─────────────────────────────────

function scheduleNextTick() {
  timer = setTimeout(async () => {
    logger.info(`[DHT11] Timer tick — interval: ${INTERVAL_MS}ms (${INTERVAL_MS / 60_000} min)`);
    try {
      const saved = await fetchAndSaveDht11();
      if (saved) {
        logger.info(`[DHT11] Save successful — next fetch in ${INTERVAL_MS / 60_000} minutes`);
      } else {
        logger.debug('[DHT11] No save this tick — will retry next interval');
      }
    } catch (err) {
      logger.error(`[DHT11] Tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, INTERVAL_MS);
}

// ── Public API ──────────────────────────────────────────────────────────

export function startDht11Storage() {
  if (timer) {
    logger.warn('[DHT11] Already running');
    return;
  }

  ensureStatements();

  // First tick after a short delay
  setTimeout(async () => {
    logger.info('[DHT11] Initial tick');
    try {
      const saved = await fetchAndSaveDht11();
      logger.info(`[DHT11] Initial tick result: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[DHT11] Initial tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, 6_000);

  logger.info(`[DHT11] Started (interval: ${INTERVAL_MS}ms = ${INTERVAL_MS / 60_000} min)`);
}

export function stopDht11Storage() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('[DHT11] Stopped');
}

export function getDht11StorageStatus() {
  return {
    running: !!timer,
    interval_ms: INTERVAL_MS,
    interval_minutes: INTERVAL_MS / 60_000,
    last_save_time: lastSaveTime ? new Date(lastSaveTime).toISOString() : null,
  };
}

/**
 * Get the latest DHT11 record from the database.
 */
export function getLatestDht11() {
  try {
    const row = disasterDb
      .prepare('SELECT * FROM HumidityTemp_readings ORDER BY id DESC LIMIT 1')
      .get();
    if (!row) return null;
    return {
      id: row.id,
      device_id: row.device_id,
      temperature: row.temperature,
      humidity: row.humidity,
      latitude: row.latitude,
      longitude: row.longitude,
      recorded_at: row.recorded_at,
    };
  } catch (err) {
    logger.error(`[DHT11] getLatestDht11 failed: ${err.message}`);
    return null;
  }
}
