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
const ARCGIS_URL = 'https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query';

const INTERVAL_MS = 15 * 60_000;

let timer = null;
let lastSaveTime = null;

let insertStmt = null;

// ── Local gauging station data (fallback when Edge Gateway is unreachable) ──
// Source: edge-gateway/resources/gauging_stations.csv
const LOCAL_STATIONS = [
  { name: 'Nagalagam Street', river: 'Kelani Ganga', lat: 6.9603, lon: 79.8786, alert: 1.2192, minor: 1.524, major: 2.1336 },
  { name: 'Hanwella', river: 'Kelani Ganga', lat: 6.9105, lon: 80.0813, alert: 7.0, minor: 8.0, major: 10.0 },
  { name: 'Glencourse', river: 'Kelani Ganga', lat: 6.9757, lon: 80.1866, alert: 15.0, minor: 16.5, major: 19.0 },
  { name: 'Kithulgala', river: 'Kelani Ganga', lat: 6.9853, lon: 80.4254, alert: 3.0, minor: 4.0, major: 6.0 },
  { name: 'Norwood', river: 'Kelani Ganga', lat: 6.8396, lon: 80.6124, alert: 1.5, minor: 3.0, major: 4.5 },
  { name: 'Deraniyagala', river: 'Kelani Ganga', lat: 6.93, lon: 80.34, alert: 4.8, minor: 5.8, major: 6.4 },
  { name: 'Holombuwa', river: 'Kelani Ganga', lat: 7.19, lon: 80.27, alert: 3.0, minor: 3.4, major: 5.0 },
  { name: 'Ellagawa', river: 'Kalu Ganga', lat: 6.7304, lon: 80.2131, alert: 10.0, minor: 10.7, major: 12.2 },
  { name: 'Rathnapura', river: 'Kalu Ganga', lat: 6.6899, lon: 80.3803, alert: 5.2, minor: 7.5, major: 9.5 },
  { name: 'Kalawellawa', river: 'Kalu Ganga', lat: 6.6315, lon: 80.1607, alert: 5.0, minor: 6.5, major: 8.0 },
  { name: 'Putupaula', river: 'Kalu Ganga', lat: 6.6116, lon: 80.0597, alert: 3.0, minor: 4.0, major: 5.0 },
  { name: 'Manampitiya', river: 'Mahaweli Ganga', lat: 7.9133, lon: 81.089, alert: 3.0, minor: 4.3, major: 6.0 },
  { name: 'Nawalapitiya', river: 'Mahaweli Ganga', lat: 7.046, lon: 80.5262, alert: 3.5, minor: 5.0, major: 6.0 },
  { name: 'Peradeniya', river: 'Mahaweli Ganga', lat: 7.2642, lon: 80.5936, alert: 5.0, minor: 7.0, major: 9.0 },
  { name: 'Weraganthota', river: 'Mahaweli Ganga', lat: 7.33, lon: 80.9879, alert: 5.0, minor: 6.0, major: 8.0 },
  { name: 'Thaldena', river: 'Mahaweli Ganga', lat: 7.0927, lon: 81.0487, alert: 3.0, minor: 4.0, major: 5.0 },
  { name: 'Badalgama', river: 'Maha Oya', lat: 7.2931, lon: 79.9777, alert: 5.0, minor: 6.2, major: 9.6 },
  { name: 'Giriulla', river: 'Maha Oya', lat: 7.3303, lon: 80.1243, alert: 5.5, minor: 6.5, major: 7.5 },
  { name: 'Baddegama', river: 'Gin Ganga', lat: 6.1775, lon: 80.1805, alert: 3.5, minor: 4.0, major: 5.0 },
  { name: 'Thawalama', river: 'Gin Ganga', lat: 6.3429, lon: 80.3319, alert: 4.0, minor: 6.0, major: 7.5 },
  { name: 'Panadugama', river: 'Nilwala Ganga', lat: 6.1101, lon: 80.4807, alert: 5.0, minor: 6.0, major: 7.5 },
  { name: 'Pitabeddara', river: 'Nilwala Ganga', lat: 6.2071, lon: 80.4504, alert: 4.0, minor: 5.0, major: 6.5 },
  { name: 'Thalgahagoda', river: 'Nilwala Ganga', lat: 6.0123, lon: 80.5348, alert: 1.4, minor: 1.7, major: 2.8 },
  { name: 'Urawa', river: 'Nilwala Ganga', lat: 6.2365, lon: 80.5663, alert: 2.5, minor: 4.0, major: 6.0 },
  { name: 'Thanamalwila', river: 'Kirindi Oya', lat: 6.4428, lon: 81.1389, alert: 4.0, minor: 5.0, major: 5.5 },
  { name: 'Wellawaya', river: 'Kirindi Oya', lat: 6.7332, lon: 81.1099, alert: 4.4, minor: 5.4, major: 5.9 },
  { name: 'Deraniyagala', river: 'Seethawaka Ganga', lat: 6.9258, lon: 80.3392, alert: 4.8, minor: 5.8, major: 6.4 },
  { name: 'Dunamale', river: 'Attanagalu Oya', lat: 7.113, lon: 80.079, alert: 3.3, minor: 4.4, major: 5.5 },
  { name: 'Galgamuwa', river: 'Mee Oya', lat: 7.9684, lon: 80.2614, alert: 4.84, minor: 5.94, major: 8.0 },
  { name: 'Holombuwa', river: 'Gurugoda Oya', lat: 7.1886, lon: 80.2738, alert: 3.0, minor: 3.4, major: 5.0 },
  { name: 'Horowpothana', river: 'Yan Oya', lat: 8.5771, lon: 80.8812, alert: 6.0, minor: 7.5, major: 10.5 },
  { name: 'Katharagama', river: 'Menik Ganga', lat: 6.4184, lon: 81.3316, alert: 4.0, minor: 4.6, major: 6.5 },
  { name: 'Magura', river: 'Maguru Ganga', lat: 6.5137, lon: 80.244, alert: 4.0, minor: 6.0, major: 7.5 },
  { name: 'Moragaswewa', river: 'Deduru Oya', lat: 7.7319, lon: 80.243, alert: 4.75, minor: 6.0, major: 7.0 },
  { name: 'Moraketiya', river: 'Walawe Ganga', lat: 6.3451, lon: 80.902, alert: 3.0, minor: 5.0, major: 7.0 },
  { name: 'Nakkala', river: 'Kumbukkan Oya', lat: 6.8903, lon: 81.2979, alert: 5.0, minor: 6.0, major: 7.5 },
  { name: 'Padiyathalawa', river: 'Maduru Oya', lat: 7.3827, lon: 81.1948, alert: 4.0, minor: 4.5, major: 6.0 },
  { name: 'Siyambalanduwa', river: 'Heda Oya', lat: 6.9055, lon: 81.5454, alert: 4.5, minor: 6.0, major: 7.0 },
  { name: 'Thanthirimale', river: 'Malwathu Oya', lat: 8.5808, lon: 80.284, alert: 5.0, minor: 6.8, major: 7.8 },
  { name: 'Yaka Wewa', river: 'Ma Oya', lat: 8.7265, lon: 80.6751, alert: 4.0, minor: 5.0, major: 6.0 },
];

function resolveStationLocally(lat, lon) {
  let best = null;
  let bestDist = Infinity;
  for (const s of LOCAL_STATIONS) {
    const dLat = (s.lat - lat) * 111000;
    const dLon = (s.lon - lon) * 111000 * Math.cos((lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best ? { ...best, distance_meters: Math.round(bestDist) } : null;
}

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

  // Try Edge Gateway first
  try {
    const url = `${EDGE_API}/hydrospatial/nearest-river-gauging-station?lat=${gps.latitude}&lon=${gps.longitude}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (res.ok) {
      const data = await res.json();
      const name = data.gauging_station?.station_name || null;
      if (name) {
        cachedStationName = name;
        cachedStationGps = { latitude: gps.latitude, longitude: gps.longitude };
        return name;
      }
    }
  } catch (_) {}

  // Fallback: local station resolution
  const local = resolveStationLocally(gps.latitude, gps.longitude);
  if (local) {
    cachedStationName = local.name;
    cachedStationGps = { latitude: gps.latitude, longitude: gps.longitude };
    logger.info(`[WATER_LEVEL] Resolved station locally: ${local.name} (${local.distance_meters}m)`);
    return local.name;
  }

  return cachedStationName;
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

/**
 * Direct ArcGIS live gauge data — bypasses Edge Gateway Overpass calls.
 * Used as fallback when Edge Gateway live-payload is unavailable or slow.
 */
async function fetchArcGISLiveDirect(gaugeName) {
  const params = new URLSearchParams({
    where: `gauge='${gaugeName}'`,
    outFields: '*',
    orderByFields: 'EditDate DESC',
    resultRecordCount: '1',
    f: 'json',
  });

  const res = await fetch(`${ARCGIS_URL}?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ArcGIS returned ${res.status}`);
  const data = await res.json();
  const features = data.features || [];
  if (features.length === 0) throw new Error('No features found');

  const attr = features[0].attributes || {};
  const geom = features[0].geometry || {};

  return {
    live_gauge_data: {
      gauge: attr.gauge,
      basin: attr.basin,
      water_level: attr.water_level,
      rainfall: attr.rain_fall,
      alert_level: attr.alertpull,
      minor_flood_level: attr.minorpull,
      major_flood_level: attr.majorpull,
      created_at: attr.CreationDate,
      updated_at: attr.EditDate,
      latitude: geom.y,
      longitude: geom.x,
    },
    gauging_station: {
      station_name: attr.gauge,
      river: attr.basin,
      distance_meters: null,
      alert_level: attr.alertpull,
      minor_flood_level: attr.minorpull,
      major_flood_level: attr.majorpull,
      gauge_latitude: geom.y,
      gauge_longitude: geom.x,
    },
    nearest_river: {
      name: attr.basin,
    },
  };
}

// ── Core fetch + save logic ─────────────────────────────────────────────

export async function fetchAndSaveWaterLevel() {
  ensureStatements();

  const gps = getLatestPersistedGps();
  if (!gps) {
    logger.warn('[WATER_LEVEL] No GPS location available — skipping');
    return false;
  }

  let { data, error } = await fetchLivePayload(gps.latitude, gps.longitude, gps.altitude);

  // Fallback: direct ArcGIS query if Edge Gateway fails
  if (error || !data) {
    const stationName = await resolveStationName(gps);
    if (stationName) {
      try {
        data = await fetchArcGISLiveDirect(stationName);
        error = null;
        logger.info(`[WATER_LEVEL] Used direct ArcGIS fallback for ${stationName}`);
      } catch (arcErr) {
        logger.warn(`[WATER_LEVEL] ArcGIS fallback also failed: ${arcErr.message}`);
      }
    }
  }

  if (error || !data) {
    logger.warn(`[WATER_LEVEL] Fetch failed: ${error || 'no data'}`);
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

/**
 * Direct ArcGIS FeatureServer query — bypasses Edge Gateway.
 * Used as fallback when Edge Gateway /water-level-history is unavailable.
 */
async function fetchArcGISHistoryDirect(gaugeName, hours = 24) {
  const recordCount = Math.min(hours * 4 + 20, 500);
  const params = new URLSearchParams({
    where: `gauge='${gaugeName}'`,
    outFields: 'gauge,water_level,EditDate',
    orderByFields: 'EditDate DESC',
    resultRecordCount: String(recordCount),
    returnGeometry: 'false',
    f: 'json',
  });

  const res = await fetch(`${ARCGIS_URL}?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ArcGIS returned ${res.status}`);
  const data = await res.json();
  const features = data.features || [];

  const readings = [];
  for (const feat of features) {
    const attr = feat.attributes || {};
    const wl = attr.water_level;
    const editDate = attr.EditDate;
    if (wl == null || editDate == null) continue;
    const ts = new Date(editDate).toISOString();
    readings.push({ gauge: attr.gauge, water_level: wl, timestamp: ts });
  }
  readings.reverse();
  return readings;
}

/**
 * Fetch water level history: try Edge Gateway first, fall back to direct ArcGIS.
 */
async function fetchWaterLevelHistoryFromSource(stationName, hours) {
  // Try Edge Gateway first
  try {
    const url = `${EDGE_API}/hydrospatial/water-level-history?station=${encodeURIComponent(stationName)}&hours=${hours}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (res.ok) {
      const data = await res.json();
      if (data.readings?.length > 0) return { source: 'edge-gateway', readings: data.readings };
    }
  } catch (_) {}

  // Fallback: direct ArcGIS query
  try {
    const readings = await fetchArcGISHistoryDirect(stationName, hours);
    return { source: 'arcgis-direct', readings };
  } catch (err) {
    throw new Error(`Both Edge Gateway and ArcGIS failed: ${err.message}`);
  }
}

export async function fetchAndSaveWaterLevelHistory(stationName, hours = 24) {
  ensureStatements();

  const gps = getLatestPersistedGps();
  if (!gps) {
    logger.warn('[WATER_LEVEL] No GPS — skipping history backfill');
    return 0;
  }

  try {
    const { source, readings } = await fetchWaterLevelHistoryFromSource(stationName, hours);

    let inserted = 0;
    for (const r of readings || []) {
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
      logger.info(`[WATER_LEVEL] Backfilled ${inserted} readings from ${source} (${hours}h)`);
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

/**
 * Clear all water level readings from the database.
 */
export function clearWaterLevelData() {
  try {
    const result = disasterDb.prepare('DELETE FROM water_level_readings').run();
    logger.info(`[WATER_LEVEL] Cleared ${result.changes} readings`);
    return { cleared: result.changes };
  } catch (err) {
    logger.error(`[WATER_LEVEL] Clear failed: ${err.message}`);
    return { cleared: 0, error: err.message };
  }
}

/**
 * Clear and re-fetch water level history from ArcGIS.
 */
export async function refreshWaterLevelData(stationName, hours = 24) {
  ensureStatements();

  const gps = getLatestPersistedGps();
  if (!gps) {
    logger.warn('[WATER_LEVEL] No GPS — cannot refresh');
    return { cleared: 0, inserted: 0, error: 'No GPS location available' };
  }

  const station = stationName || cachedStationName;
  if (!station) {
    const resolved = await resolveStationName(gps);
    if (!resolved) {
      return { cleared: 0, inserted: 0, error: 'No gauging station found' };
    }
    return refreshWaterLevelData(resolved, hours);
  }

  const clearResult = clearWaterLevelData();
  const inserted = await fetchAndSaveWaterLevelHistory(station, hours);

  let liveSaved = false;
  try {
    liveSaved = await fetchAndSaveWaterLevel();
  } catch (_) {}

  return {
    cleared: clearResult.cleared,
    inserted,
    live_saved: liveSaved,
    station,
  };
}
