/**
 * hydrospatial-storage.js — Persists hydro-spatial analysis data into disaster.db.
 *
 * Every 30 minutes:
 *   1. Get latest GPS from DB
 *   2. Call Edge Gateway /hydrospatial/analysis
 *   3. Save result into hydrospatial_data
 *
 * Frontend reads from /api/disaster/hydrospatial/latest.
 */
import { disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nowISO } from '../../utils/helpers.js';
import { gpsChangeEmitter } from './gps-storage.js';

const DEVICE_ID = C.DEVICE_ID;
const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

const INTERVAL_MS = (C.HYDROSPATIAL_STORAGE_INTERVAL_MINUTES || 30) * 60_000;

let timer = null;
let lastSaveTime = null;

let insertStmt = null;

function ensureStatements() {
  if (insertStmt) return;
  insertStmt = disasterDb.prepare(`
    INSERT INTO hydrospatial_data
      (latitude, longitude, elevation, river_distance,
       river_name, gauge_elevation, elevation_difference, gauge_distance,
       gauge_latitude, gauge_longitude, station_name, source, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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

async function fetchHydrospatialAnalysis(lat, lon, alt) {
  try {
    const url = `${EDGE_API}/hydrospatial/analysis?lat=${lat}&lon=${lon}&alt=${alt || 10}`;
    logger.info(`[HYDROSPATIAL] Fetching: ${url}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    logger.info(`[HYDROSPATIAL] Response status: ${response.status}`);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { data: null, error: `Gateway returned ${response.status}: ${body.substring(0, 200)}` };
    }
    const data = await response.json();
    const errorCount = Object.keys(data.errors || {}).length;
    logger.info(`[HYDROSPATIAL] Payload received: camp_elevation=${data.camp_elevation}, river=${data.river_name}, station=${data.station_name}, errors=${errorCount}`);
    return { data, error: null };
  } catch (err) {
    logger.error(`[HYDROSPATIAL] Fetch error: ${err.message}`);
    return { data: null, error: err.message };
  }
}

// ── Core fetch + save logic ─────────────────────────────────────────────

export async function fetchAndSaveHydrospatial() {
  ensureStatements();

  const gps = getLatestPersistedGps();
  if (!gps) {
    logger.warn('[HYDROSPATIAL] No GPS location available — skipping');
    return false;
  }
  logger.info(`[HYDROSPATIAL] Using GPS: lat=${gps.latitude}, lon=${gps.longitude}, alt=${gps.altitude}`);

  const { data, error } = await fetchHydrospatialAnalysis(gps.latitude, gps.longitude, gps.altitude);
  if (error || !data) {
    logger.warn(`[HYDROSPATIAL] Fetch from Edge Gateway failed: ${error || 'no data'}`);
    return false;
  }

  const now = nowISO();
  const elevation = data.camp_elevation ?? null;
  const riverDistance = data.river_distance_km ?? null;
  const riverName = data.river_name ?? data.nearest_river?.name ?? null;
  const gaugeElevation = data.gauge_elevation ?? null;
  const elevationDifference = data.elevation_difference ?? null;
  const gaugeDistance = data.gauge_distance_km ?? null;
  const gaugeLatitude = data.gauge_latitude ?? data.gauging_station?.gauge_latitude ?? null;
  const gaugeLongitude = data.gauge_longitude ?? data.gauging_station?.gauge_longitude ?? null;
  const stationName = data.station_name ?? data.gauging_station?.station_name ?? null;

  logger.info(`[HYDROSPATIAL] Mapping: elev=${elevation}, gauge_elev=${gaugeElevation}, diff=${elevationDifference}, river=${riverDistance}km, gauge=${gaugeDistance}km`);

  try {
    const result = insertStmt.run(
      gps.latitude,
      gps.longitude,
      elevation,
      riverDistance,
      riverName,
      gaugeElevation,
      elevationDifference,
      gaugeDistance,
      gaugeLatitude,
      gaugeLongitude,
      stationName,
      'HYDROSPATIAL_ANALYSIS',
      now,
    );

    lastSaveTime = Date.now();
    logger.info(`[HYDROSPATIAL] Insert OK: changes=${result.changes}, lastInsertRowid=${result.lastInsertRowid}`);
    return true;
  } catch (err) {
    logger.error(`[HYDROSPATIAL] DB insert failed: ${err.message}`);
    logger.error(`[HYDROSPATIAL] Insert params: lat=${gps.latitude}, lon=${gps.longitude}, elev=${elevation}, river=${riverName}, station=${stationName}`);
    return false;
  }
}

// ── Periodic timer ──────────────────────────────────────────────────────

function scheduleNextTick() {
  timer = setTimeout(async () => {
    logger.info('[HYDROSPATIAL] Timer tick');
    try {
      const saved = await fetchAndSaveHydrospatial();
      logger.info(`[HYDROSPATIAL] Tick result: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[HYDROSPATIAL] Tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, INTERVAL_MS);
}

// ── Public API ──────────────────────────────────────────────────────────

export function startHydrospatialStorage() {
  if (timer) {
    logger.warn('[HYDROSPATIAL] Already running');
    return;
  }

  ensureStatements();

  setTimeout(async () => {
    logger.info('[HYDROSPATIAL] Initial tick');
    try {
      const saved = await fetchAndSaveHydrospatial();
      logger.info(`[HYDROSPATIAL] Initial tick result: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[HYDROSPATIAL] Initial tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, 15_000); // 15s delay to allow other services to start first

  // Listen for GPS changes → immediate re-fetch
  gpsChangeEmitter.on('gps-changed', async (gps) => {
    logger.info(`[HYDROSPATIAL] GPS changed to ${gps.latitude}, ${gps.longitude} — triggering immediate re-fetch`);
    try {
      await fetchAndSaveHydrospatial();
    } catch (err) {
      logger.error(`[HYDROSPATIAL] GPS-change re-fetch error: ${err.message}`);
    }
  });

  logger.info('[HYDROSPATIAL] Started (interval: 30 min)');
}

export function stopHydrospatialStorage() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('[HYDROSPATIAL] Stopped');
}

export function getHydrospatialStorageStatus() {
  return {
    running: !!timer,
    interval_ms: INTERVAL_MS,
    interval_minutes: INTERVAL_MS / 60_000,
    last_save_time: lastSaveTime ? new Date(lastSaveTime).toISOString() : null,
  };
}

/**
 * Get the latest hydrospatial record from the database.
 */
export function getLatestHydrospatial() {
  try {
    const row = disasterDb
      .prepare('SELECT * FROM hydrospatial_data ORDER BY id DESC LIMIT 1')
      .get();
    if (!row) return null;
    return {
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      elevation: row.elevation,
      river_distance: row.river_distance,
      river_name: row.river_name,
      gauge_elevation: row.gauge_elevation,
      elevation_difference: row.elevation_difference,
      gauge_distance: row.gauge_distance,
      gauge_latitude: row.gauge_latitude,
      gauge_longitude: row.gauge_longitude,
      station_name: row.station_name,
      source: row.source,
      created_at: row.created_at,
    };
  } catch (err) {
    logger.error(`[HYDROSPATIAL] getLatestHydrospatial failed: ${err.message}`);
    return null;
  }
}

/**
 * Get recent hydrospatial readings for chart history.
 */
export function getHydrospatialHistory(limit = 20) {
  try {
    const rows = disasterDb
      .prepare('SELECT elevation, river_distance, gauge_elevation, elevation_difference, created_at FROM hydrospatial_data ORDER BY id DESC LIMIT ?')
      .all(limit);
    return rows.reverse();
  } catch (err) {
    logger.error(`[HYDROSPATIAL] getHydrospatialHistory failed: ${err.message}`);
    return [];
  }
}
