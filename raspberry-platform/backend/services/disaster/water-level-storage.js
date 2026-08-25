/**
 * water-level-storage.js — Persists water level readings into disaster.db.
 *
 * Every 15 minutes:
 *   1. Get latest GPS from DB
 *   2. Call Edge Gateway /hydrospatial/live-payload
 *   3. Save result into water_level_readings
 *
 * Frontend reads from /api/disaster/water-level/latest.
 */
import { disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nowISO } from '../../utils/helpers.js';

const DEVICE_ID = C.DEVICE_ID;
const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

const INTERVAL_MS = 15 * 60_000;

let timer = null;
let lastSaveTime = null;

let insertStmt = null;

function ensureStatements() {
  if (insertStmt) return;
  insertStmt = disasterDb.prepare(`
    INSERT INTO water_level_readings
      (device_id, station_id, water_level, unit, latitude, longitude,
       river_name, station_name, distance_km, alert_level,
       minor_flood_level, major_flood_level, rainfall,
       gauge_latitude, gauge_longitude, source, updated_at, recorded_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function getLatestPersistedGps() {
  try {
    const row = disasterDb
      .prepare('SELECT latitude, longitude, altitude FROM gps_readings ORDER BY id DESC LIMIT 1')
      .get();
    if (row && row.latitude != null && row.longitude != null) {
      return row;
    }
  } catch (_) {}
  return null;
}

async function fetchLivePayload(lat, lon, alt) {
  try {
    const url = `${EDGE_API}/hydrospatial/live-payload?lat=${lat}&lon=${lon}&alt=${alt || 10}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
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

export async function fetchAndSaveWaterLevel() {
  ensureStatements();

  const gps = getLatestPersistedGps();
  if (!gps) {
    logger.warn('[WATER_LEVEL] No GPS location available — skipping');
    return false;
  }

  const { data, error } = await fetchLivePayload(gps.latitude, gps.longitude, gps.altitude);
  if (error || !data) {
    logger.warn(`[WATER_LEVEL] Fetch from Edge Gateway failed: ${error || 'no data'}`);
    return false;
  }

  const gauge = data.live_gauge_data || {};
  const river = data.nearest_river || {};
  const station = data.gauging_station || {};
  const now = nowISO();

  const waterLevel = gauge.water_level ?? null;
  if (waterLevel == null) {
    logger.warn('[WATER_LEVEL] No water level in response — skipping');
    return false;
  }

  const riverName = river.name || gauge.basin || station.river || null;
  const stationName = station.station_name || gauge.gauge || null;
  const stationId = gauge.gauge || station.ref || null;
  const distanceM = station.distance_meters ?? station.distance_to_station_meters ?? null;
  const distanceKm = distanceM != null ? Number((distanceM / 1000).toFixed(1)) : null;
  const alertLevel = gauge.alert_level ?? station.alert_level ?? null;
  const minorFlood = gauge.minor_flood_level ?? station.minor_flood_level ?? null;
  const majorFlood = gauge.major_flood_level ?? station.major_flood_level ?? null;
  const rainfall = gauge.rainfall ?? null;
  const gaugeLat = gauge.latitude ?? null;
  const gaugeLon = gauge.longitude ?? null;
  let updatedAt = gauge.updated_at || gauge.created_at || now;
  if (typeof updatedAt === 'number') updatedAt = new Date(updatedAt).toISOString();

  try {
    insertStmt.run(
      DEVICE_ID,
      stationId,
      waterLevel,
      'm',
      gps.latitude,
      gps.longitude,
      riverName,
      stationName,
      distanceKm,
      alertLevel,
      minorFlood,
      majorFlood,
      rainfall,
      gaugeLat,
      gaugeLon,
      'LIVE_PAYLOAD',
      updatedAt,
      now,
    );

    lastSaveTime = Date.now();
    logger.info(`[WATER_LEVEL] Saved: ${waterLevel}m at ${stationName || 'unknown station'} (${riverName || 'unknown river'})`);
    return true;
  } catch (err) {
    logger.error(`[WATER_LEVEL] DB insert failed: ${err.message}`);
    return false;
  }
}

// ── Periodic timer ──────────────────────────────────────────────────────

function scheduleNextTick() {
  timer = setTimeout(async () => {
    logger.info('[WATER_LEVEL] Timer tick');
    try {
      const saved = await fetchAndSaveWaterLevel();
      logger.info(`[WATER_LEVEL] Tick result: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[WATER_LEVEL] Tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, INTERVAL_MS);
}

// ── Public API ──────────────────────────────────────────────────────────

export function startWaterLevelStorage() {
  if (timer) {
    logger.warn('[WATER_LEVEL] Already running');
    return;
  }

  ensureStatements();

  setTimeout(async () => {
    logger.info('[WATER_LEVEL] Initial tick');
    try {
      const saved = await fetchAndSaveWaterLevel();
      logger.info(`[WATER_LEVEL] Initial tick result: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[WATER_LEVEL] Initial tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, 10_000);

  logger.info('[WATER_LEVEL] Started (interval: 15 min)');
}

export function stopWaterLevelStorage() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('[WATER_LEVEL] Stopped');
}

export function getWaterLevelStorageStatus() {
  return {
    running: !!timer,
    interval_ms: INTERVAL_MS,
    interval_minutes: INTERVAL_MS / 60_000,
    last_save_time: lastSaveTime ? new Date(lastSaveTime).toISOString() : null,
  };
}

/**
 * Get the latest water level record from the database.
 */
export function getLatestWaterLevel() {
  try {
    const row = disasterDb
      .prepare('SELECT * FROM water_level_readings ORDER BY id DESC LIMIT 1')
      .get();
    if (!row) return null;
    return {
      id: row.id,
      device_id: row.device_id,
      water_level: row.water_level,
      unit: row.unit,
      river_name: row.river_name,
      station_name: row.station_name,
      station_id: row.station_id,
      distance_km: row.distance_km,
      latitude: row.latitude,
      longitude: row.longitude,
      alert_level: row.alert_level,
      minor_flood_level: row.minor_flood_level,
      major_flood_level: row.major_flood_level,
      rainfall: row.rainfall,
      gauge_latitude: row.gauge_latitude,
      gauge_longitude: row.gauge_longitude,
      source: row.source,
      updated_at: row.updated_at,
      recorded_at: row.recorded_at,
    };
  } catch (err) {
    logger.error(`[WATER_LEVEL] getLatestWaterLevel failed: ${err.message}`);
    return null;
  }
}

/**
 * Get recent water level readings for chart history.
 */
export function getWaterLevelHistory(limit = 20) {
  try {
    const rows = disasterDb
      .prepare('SELECT water_level, recorded_at FROM water_level_readings ORDER BY id DESC LIMIT ?')
      .all(limit);
    return rows.reverse();
  } catch (err) {
    logger.error(`[WATER_LEVEL] getWaterLevelHistory failed: ${err.message}`);
    return [];
  }
}
