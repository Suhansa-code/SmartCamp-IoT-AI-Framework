import { getPool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { getDeviceCampId } from '../sync/sync.postgres.repository.js';
import * as mockRepository from './camps.data.js';

const CACHE_TTL_MS = 15_000;
let cache = { expiresAt: 0, value: null };

function mapCamp(row) {
  return {
    id: row.id, code: row.code, name: row.name, lat: Number(row.lat), lng: Number(row.lng), status: row.status,
    displaced: Number(row.displaced || 0), capacity: Number(row.capacity || 0), aid: Number(row.aid || 0),
    type: row.type, workers: Number(row.workers || 0),
    elev: row.elev == null ? null : Number(row.elev),
    last_aggregation_at: row.last_aggregation_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    detail: {
      waterPath: row.water_path, river: row.river, station: row.station, stDist: Number(row.st_dist || 0),
      upDist: Number(row.up_dist || 0), wl: row.wl == null ? null : Number(row.wl), rain: row.rain == null ? null : Number(row.rain),
      alertL: row.alert_l == null ? null : Number(row.alert_l), minorL: row.minor_l == null ? null : Number(row.minor_l),
      majorL: row.major_l == null ? null : Number(row.major_l), gauLat: row.gau_lat == null ? null : Number(row.gau_lat),
      gauLng: row.gau_lng == null ? null : Number(row.gau_lng), fcLat: row.fc_lat == null ? null : Number(row.fc_lat),
      fcLng: row.fc_lng == null ? null : Number(row.fc_lng), elev: row.elev == null ? null : Number(row.elev),
      minT: row.min_t == null ? null : Number(row.min_t), maxT: row.max_t == null ? null : Number(row.max_t),
      hum: row.hum == null ? null : Number(row.hum), precip: row.precip == null ? null : Number(row.precip),
      maxHrPrec: row.max_hr_prec == null ? null : Number(row.max_hr_prec), maxWind: row.max_wind == null ? null : Number(row.max_wind),
      avgWind: row.avg_wind == null ? null : Number(row.avg_wind), soil: row.soil == null ? null : Number(row.soil),
      pres: row.pres == null ? null : Number(row.pres), cloud: row.cloud == null ? null : Number(row.cloud),
    },
  };
}

async function getCloudCamps() {
  if (cache.value && cache.expiresAt > Date.now()) return cache.value;
  const result = await getPool().query('SELECT * FROM "CAMPS" ORDER BY name');
  const camps = result.rows.map(mapCamp);
  cache = { value: camps, expiresAt: Date.now() + CACHE_TTL_MS };
  return camps;
}

export function invalidateDisasterCache() {
  cache = { expiresAt: 0, value: null };
}

// ── Device registry helpers ─────────────────────────────────────────────

export async function getDevicesForCamp(campId) {
  const pool = getPool();
  const result = await pool.query('SELECT device_id, name, status FROM devices WHERE camp_id = $1', [campId]);
  return result.rows;
}

export async function getDeviceIdsForCamp(campId) {
  const pool = getPool();
  const result = await pool.query('SELECT device_id FROM devices WHERE camp_id = $1', [campId]);
  return result.rows.map((r) => r.device_id);
}

export async function getAllDevices() {
  const pool = getPool();
  const result = await pool.query('SELECT device_id, camp_id, name, status FROM devices ORDER BY camp_id, device_id');
  return result.rows;
}

// ── Device-aware disaster queries ───────────────────────────────────────

export async function getDisasterCampById(campId) {
  if (!env.db.enabled) return null;
  const camps = await getCloudCamps();

  // First try direct camp ID match
  const directMatch = camps.find((camp) => camp.id === campId);
  if (directMatch) return directMatch;

  // If not found, check if it's a device ID and resolve to the associated camp
  try {
    const resolvedCampId = await getDeviceCampId(campId);
    if (resolvedCampId) {
      return camps.find((camp) => camp.id === resolvedCampId) || null;
    }
  } catch {
    // Device lookup failed — fall through to return null
  }

  return null;
}

export async function getDisasterCampSummaries() {
  if (!env.db.enabled) return [];
  return (await getCloudCamps()).map(({ detail, ...camp }) => camp);
}

export async function getDisasterDashboardSummary() {
  if (!env.db.enabled) {
    return {
      source: 'empty', timestamp: new Date().toISOString(), camps: [],
      map_nodes: [], total_displaced: 0, total_workers: 0, status_counts: {},
    };
  }
  const camps = await getCloudCamps();
  const statusCounts = camps.reduce((counts, camp) => ({ ...counts, [camp.status]: (counts[camp.status] || 0) + 1 }), {});
  return {
    source: 'cloud_db', timestamp: new Date().toISOString(), camps: camps.map(({ detail, ...camp }) => camp),
    map_nodes: camps.map(({ id, code, name, lat, lng, status, type }) => ({ id, code, name, lat, lng, status, type })),
    total_displaced: camps.reduce((sum, camp) => sum + camp.displaced, 0),
    total_workers: camps.reduce((sum, camp) => sum + camp.workers, 0), status_counts: statusCounts,
  };
}

export async function getDisasterMapNodes() {
  if (!env.db.enabled) return [];
  return (await getCloudCamps()).map(({ id, code, name, lat, lng, status, type }) => ({ id, code, name, lat, lng, status, type }));
}

export async function getDisasterOperationalData(campId) {
  if (!env.db.enabled) return { prediction: null, hydrospatial: null, water_level: null, alerts: [] };
  const pool = getPool();

  const deviceIds = await getDeviceIdsForCamp(campId);

  let prediction, hydrospatial, waterLevel;
  if (deviceIds.length > 0) {
    [prediction, hydrospatial, waterLevel] = await Promise.all([
      pool.query('SELECT * FROM flood_predictions WHERE device_id = ANY($1) ORDER BY predicted_at DESC LIMIT 1', [deviceIds]),
      pool.query('SELECT * FROM hydrospatial_data WHERE device_id = ANY($1) ORDER BY created_at DESC LIMIT 1', [deviceIds]),
      pool.query('SELECT * FROM water_level_readings WHERE device_id = ANY($1) ORDER BY recorded_at DESC LIMIT 1', [deviceIds]),
    ]);
  } else {
    [prediction, hydrospatial, waterLevel] = await Promise.all([
      pool.query('SELECT * FROM flood_predictions ORDER BY predicted_at DESC LIMIT 1'),
      pool.query('SELECT * FROM hydrospatial_data ORDER BY created_at DESC LIMIT 1'),
      pool.query('SELECT * FROM water_level_readings ORDER BY recorded_at DESC LIMIT 1'),
    ]);
  }

  const alerts = await pool.query(
    'SELECT * FROM disaster_alerts WHERE camp_id = $1 AND status IN (\'ACTIVE\', \'ACKNOWLEDGED\') ORDER BY created_at DESC',
    [campId]
  );

  const row = prediction.rows[0];
  return {
    prediction: row ? {
      probability: Number(row.flood_probability), category: row.flood_category, forecast_hours: row.forecast_hours,
      prediction_timestamp: row.predicted_at, source: row.model_version,
    } : null,
    hydrospatial: hydrospatial.rows[0] || null,
    water_level: waterLevel.rows[0] || null,
    alerts: alerts.rows,
  };
}
