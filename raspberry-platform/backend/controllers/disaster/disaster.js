import * as disasterService from '../../services/disaster/disaster.js';
import * as gpsService from '../../services/disaster/gps.js';
import { getLatestWeather, getWeatherStorageStatus } from '../../services/disaster/weather-storage.js';
import { getLatestRainfall, getRainfallStorageStatus, fetchAndSaveRainfall } from '../../services/disaster/rainfall-storage.js';
import { getLatestDht11, getDht11StorageStatus, fetchAndSaveDht11 } from '../../services/disaster/dht11-storage.js';
import { getLatestWaterLevel, getWaterLevelHistory, getWaterLevelStorageStatus, fetchAndSaveWaterLevel } from '../../services/disaster/water-level-storage.js';
import { getLatestSensorStatus, getSensorStatusStorageStatus, fetchAndSaveSensorStatus } from '../../services/disaster/sensor-status-storage.js';
import { getLatestHydrospatial, getHydrospatialHistory, getHydrospatialStorageStatus, fetchAndSaveHydrospatial } from '../../services/disaster/hydrospatial-storage.js';
import { getFloodPrediction } from '../../services/disaster/prediction-service.js';
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
      .prepare('SELECT latitude, longitude, altitude, accuracy, source, location_name, location_district, recorded_at FROM gps_readings ORDER BY id DESC LIMIT 1')
      .get();

    if (!row) {
      const empty = { latitude: null, longitude: null, altitude: null, accuracy: null, source: null, location_name: null, location_district: null, recorded_at: null };
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

export function getLatestWeatherData(req, res) {
  try {
    const weather = getLatestWeather();
    if (!weather) {
      return res.json({ available: false, message: 'No weather data available yet' });
    }
    res.json({ available: true, ...weather });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
}

export function getWeatherStatus(req, res) {
  try {
    const status = getWeatherStorageStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weather status' });
  }
}

export function getLatestRainfallData(req, res) {
  try {
    const rainfall = getLatestRainfall();
    if (!rainfall) {
      return res.json({ available: false, message: 'No rainfall data available yet' });
    }
    res.json({ available: true, ...rainfall });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rainfall data' });
  }
}

export function getRainfallStatus(req, res) {
  try {
    const status = getRainfallStorageStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rainfall status' });
  }
}

export async function triggerRainfallSave(req, res) {
  try {
    const saved = await fetchAndSaveRainfall();
    res.json({ saved, message: saved ? 'Rainfall data saved to DB' : 'No data saved (sensor inactive or fetch failed)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function getLatestDht11Data(req, res) {
  try {
    const dht11 = getLatestDht11();
    if (!dht11) {
      return res.json({ available: false, message: 'No DHT11 data available yet' });
    }
    res.json({ available: true, ...dht11 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch DHT11 data' });
  }
}

export function getDht11Status(req, res) {
  try {
    const status = getDht11StorageStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch DHT11 status' });
  }
}

export async function triggerDht11Save(req, res) {
  try {
    const saved = await fetchAndSaveDht11();
    res.json({ saved, message: saved ? 'DHT11 data saved to DB' : 'No data saved (sensor inactive or fetch failed)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function getLatestWaterLevelData(req, res) {
  try {
    const wl = getLatestWaterLevel();
    if (!wl) {
      return res.json({ available: false, message: 'No water level data available yet' });
    }
    res.json({ available: true, ...wl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch water level data' });
  }
}

export function getWaterLevelHistoryData(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const history = getWaterLevelHistory(limit);
    res.json({ readings: history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch water level history' });
  }
}

export function getWaterLevelStatus(req, res) {
  try {
    const status = getWaterLevelStorageStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch water level status' });
  }
}

export async function triggerWaterLevelSave(req, res) {
  try {
    const saved = await fetchAndSaveWaterLevel();
    res.json({ saved, message: saved ? 'Water level data saved to DB' : 'No data saved (GPS unavailable or fetch failed)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function getLatestSensorStatusData(req, res) {
  try {
    const status = getLatestSensorStatus();
    if (!status) {
      return res.json({ available: false, message: 'No sensor status data available yet' });
    }
    res.json({ available: true, ...status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sensor status data' });
  }
}

export function getSensorStatus(req, res) {
  try {
    const status = getSensorStatusStorageStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sensor status' });
  }
}

export async function triggerSensorStatusSave(req, res) {
  try {
    const saved = await fetchAndSaveSensorStatus();
    res.json({ saved, message: saved ? 'Sensor status saved to DB' : 'No data saved (gateway unreachable)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Hydrospatial ────────────────────────────────────────────────────────

export function getLatestHydrospatialData(req, res) {
  try {
    const data = getLatestHydrospatial();
    if (!data) {
      return res.json({ available: false, message: 'No hydrospatial data available yet' });
    }
    res.json({ available: true, ...data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hydrospatial data' });
  }
}

export function getHydrospatialHistoryData(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const history = getHydrospatialHistory(limit);
    res.json({ readings: history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hydrospatial history' });
  }
}

export function getHydrospatialStatus(req, res) {
  try {
    const status = getHydrospatialStorageStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hydrospatial status' });
  }
}

export async function triggerHydrospatialSave(req, res) {
  try {
    const saved = await fetchAndSaveHydrospatial();
    res.json({ saved, message: saved ? 'Hydrospatial data saved to DB' : 'No data saved (GPS unavailable or fetch failed)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Flood Prediction ─────────────────────────────────────────────────

export async function getFloodPredictionData(req, res) {
  try {
    const result = await getFloodPrediction();
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
}
