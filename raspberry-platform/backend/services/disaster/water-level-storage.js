/**
 * water-level-storage.js — Persists water level readings into disaster.db.
 *
 * On startup:
 *   1. Resolve station name from GPS (cached)
 *   2. Backfill gap from ArcGIS historical readings (gap-aware)
 *   3. Fetch current reading from Edge Gateway live-payload
 *
 * Every 15 minutes:
 *   4. Fetch current reading from Edge Gateway live-payload
 *
 * Frontend reads from /api/disaster/water-level/latest and /water-level/history.
 */
import { disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nowISO } from '../../utils/helpers.js';
import { gpsChangeEmitter } from './gps-storage.js';

const DEVICE_ID = C.DEVICE_ID;
const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

const INTERVAL_MS = 15 * 60_000;

let timer = null;
let lastSaveTime = null;

let insertStmt = null;

// ── Station name cache ──────────────────────────────────────────────────
let cachedStationName = null;
let cachedStationGps = null;
const STATION_CACHE_DISTANCE_M = 100;

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

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveStationName(gps) {
  if (cachedStationName && cachedStationGps) {
    const dist = haversineDistance(
      gps.latitude, gps.longitude,
      cachedStationGps.latitude, cachedStationGps.longitude
    );
    if (dist < STATION_CACHE_DISTANCE_M) return cachedStationName;
  }

  try {
    const url = `${EDGE_API}/hydrospatial/nearest-river-gauging-station?lat=${gps.latitude}&lon=${gps.longitude}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return cachedStationName;
    const data = await res.json();
    const name = data.gauging_station?.station_name || null;
    if (name) {
      cachedStationName = name;
      cachedStationGps = { latitude: gps.latitude, longitude: gps.longitude };
    }
    return name;
  } catch (err) {
    logger.warn(`[WATER_LEVEL] Station resolve failed: ${err.message}`);
    return cachedStationName;
  }
}

function getLastRecordedAt() {
  try {
    const row = disasterDb
      .prepare('SELECT recorded_at FROM water_level_readings ORDER BY id DESC LIMIT 1')
      .get();
    return row?.recorded_at || null;
  } catch (_) {
    return null;
  }
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

// ── ArcGIS history backfill ─────────────────────────────────────────────

export async function fetchAndSaveWaterLevelHistory(stationName, hours = 24) {
  ensureStatements();

  const gps = getLatestPersistedGps();
  if (!gps) {
    logger.warn('[WATER_LEVEL] No GPS — skipping history backfill');
    return 0;
  }

  try {
    const url = `${EDGE_API}/hydrospatial/water-level-history?station=${encodeURIComponent(stationName)}&hours=${hours}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      logger.warn(`[WATER_LEVEL] History fetch failed: ${res.status}`);
      return 0;
    }
    const data = await res.json();

    let inserted = 0;
    const now = nowISO();

    for (const r of data.readings || []) {
      try {
        insertStmt.run(
          DEVICE_ID,
          stationName,
          r.water_level,
          'm',
          gps.latitude,
          gps.longitude,
          null,
          stationName,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          'ARCGIS_HISTORY',
          r.timestamp,
          r.timestamp,
        );
        inserted++;
      } catch (err) {
        if (!err.message?.includes('UNIQUE constraint')) {
          logger.warn(`[WATER_LEVEL] History insert failed: ${err.message}`);
        }
      }
    }

    if (inserted > 0) {
      logger.info(`[WATER_LEVEL] Backfilled ${inserted} readings from ArcGIS (${hours}h)`);
    }
    return inserted;
  } catch (err) {
    logger.error(`[WATER_LEVEL] History backfill failed: ${err.message}`);
    return 0;
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
    logger.info('[WATER_LEVEL] Starting up — resolving station and backfilling history');

    const gps = getLatestPersistedGps();
    if (!gps) {
      logger.warn('[WATER_LEVEL] No GPS on startup — skipping backfill, will retry on timer');
      scheduleNextTick();
      return;
    }

    const stationName = await resolveStationName(gps);
    if (!stationName) {
      logger.warn('[WATER_LEVEL] No station found — skipping backfill');
      scheduleNextTick();
      return;
    }

    // Gap-aware backfill
    const lastRecorded = getLastRecordedAt();
    let hoursToBackfill = 24;
    if (lastRecorded) {
      const gapMs = Date.now() - new Date(lastRecorded).getTime();
      const gapHours = Math.ceil(gapMs / (1000 * 60 * 60));
      hoursToBackfill = Math.max(1, Math.min(gapHours, 168));
    }

    logger.info(`[WATER_LEVEL] Backfilling ${hoursToBackfill}h from ArcGIS for station: ${stationName}`);
    try {
      const inserted = await fetchAndSaveWaterLevelHistory(stationName, hoursToBackfill);
      logger.info(`[WATER_LEVEL] Backfill complete: ${inserted} new readings`);
    } catch (err) {
      logger.error(`[WATER_LEVEL] Backfill error: ${err.message}`);
    }

    // Then fetch current reading
    try {
      const saved = await fetchAndSaveWaterLevel();
      logger.info(`[WATER_LEVEL] Live fetch: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[WATER_LEVEL] Live fetch error: ${err.message}`);
    }

    scheduleNextTick();
  }, 10_000);

  // Listen for GPS changes → immediate re-fetch
  gpsChangeEmitter.on('gps-changed', async (gps) => {
    logger.info(`[WATER_LEVEL] GPS changed to ${gps.latitude}, ${gps.longitude} — triggering immediate re-fetch`);
    try {
      await fetchAndSaveWaterLevel();
    } catch (err) {
      logger.error(`[WATER_LEVEL] GPS-change re-fetch error: ${err.message}`);
    }
  });

  logger.info('[WATER_LEVEL] Started (interval: 15 min, gap-aware backfill on startup)');
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
