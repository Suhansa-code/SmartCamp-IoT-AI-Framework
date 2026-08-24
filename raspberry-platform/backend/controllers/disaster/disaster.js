import * as disasterService from '../../services/disaster/disaster.js';
import * as gpsService from '../../services/disaster/gps.js';
import { disasterDb } from '../../config/database.js';

// ── In-memory cache for latest GPS ──────────────────────────────────────
const GPS_CACHE_TTL_MS = 30_000; // 30 seconds
let latestGpsCache = null;
let latestGpsCacheTime = 0;

export function getCamps(req, res) {
  const camps = disasterService.getCampsData();
  res.json({ camps, updated_at: new Date().toISOString() });
}

export function getCampById(req, res) {
  const camp = disasterService.getCampById(req.params.id);
  if (!camp) return res.status(404).json({ error: 'Camp not found' });
  res.json({ camp, updated_at: new Date().toISOString() });
}

export function getPredictionModels(req, res) {
  const models = disasterService.getModelMetrics();
  res.json({ models });
}

export function getOverview(req, res) {
  const result = disasterService.getOverview();
  res.json(result);
}

export async function getGpsLocation(req, res) {
  const gps = await gpsService.getGpsLocation();
  res.json(gps);
}

export function getCampIdentity(req, res) {
  const dynamicCampId = gpsService.getDynamicCampId();
  const suffix = gpsService.getCampSuffix();
  const identity = disasterService.getCampIdentity(dynamicCampId);
  res.json({ camp_id: dynamicCampId, suffix, ...identity });
}

export function getLatestGpsLocation(req, res) {
  const now = Date.now();

  // Return cached value if still valid
  if (latestGpsCache && (now - latestGpsCacheTime) < GPS_CACHE_TTL_MS) {
    return res.json(latestGpsCache);
  }

  try {
    const row = disasterDb
      .prepare('SELECT latitude, longitude, altitude, accuracy, source, recorded_at FROM gps_readings ORDER BY id DESC LIMIT 1')
      .get();

    if (!row) {
      const empty = { latitude: null, longitude: null, altitude: null, accuracy: null, source: null, recorded_at: null };
      latestGpsCache = empty;
      latestGpsCacheTime = now;
      return res.json(empty);
    }

    latestGpsCache = row;
    latestGpsCacheTime = now;
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch latest GPS' });
  }
}
