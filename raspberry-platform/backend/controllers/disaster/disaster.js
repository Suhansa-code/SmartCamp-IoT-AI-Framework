import * as disasterService from '../../services/disaster/disaster.js';
import * as gpsService from '../../services/disaster/gps.js';
import { getLatestWeather, getWeatherStorageStatus } from '../../services/disaster/weather-storage.js';
import { getLatestRainfall, getRainfallStorageStatus, fetchAndSaveRainfall } from '../../services/disaster/rainfall-storage.js';
import { getLatestDht11, getDht11StorageStatus, fetchAndSaveDht11 } from '../../services/disaster/dht11-storage.js';
import { getLatestWaterLevel, getWaterLevelHistory, getWaterLevelStorageStatus, fetchAndSaveWaterLevel, fetchAndSaveWaterLevelHistory, clearWaterLevelData, refreshWaterLevelData } from '../../services/disaster/water-level-storage.js';
import { getLatestSensorStatus, getSensorStatusStorageStatus, fetchAndSaveSensorStatus } from '../../services/disaster/sensor-status-storage.js';
import { getLatestHydrospatial, getHydrospatialHistory, getHydrospatialStorageStatus, fetchAndSaveHydrospatial } from '../../services/disaster/hydrospatial-storage.js';
import { getFloodPrediction } from '../../services/disaster/prediction-service.js';
import { getAlerts } from '../../services/disaster/alert-evaluator.js';
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
  const identity = disasterService.getCampIdentity(dynamicCampId);
  res.json({ camp_id: dynamicCampId, ...identity });
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

export async function triggerWaterLevelHistoryFetch(req, res) {
  try {
    const station = req.query.station;
    const hours = parseInt(req.query.hours, 10) || 24;
    if (!station) {
      return res.status(400).json({ error: 'station parameter is required' });
    }
    const inserted = await fetchAndSaveWaterLevelHistory(station, hours);
    res.json({ inserted, message: `Backfilled ${inserted} readings from ArcGIS (${hours}h)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function clearWaterLevelReadings(req, res) {
  try {
    const result = clearWaterLevelData();
    res.json({ cleared: result.cleared, message: `Cleared ${result.cleared} water level readings` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function refreshWaterLevelReadings(req, res) {
  try {
    const station = req.query.station || null;
    const hours = parseInt(req.query.hours, 10) || 24;
    const result = await refreshWaterLevelData(station, hours);
    res.json({
      cleared: result.cleared,
      inserted: result.inserted,
      live_saved: result.live_saved,
      station: result.station,
      message: result.error
        ? `Refresh failed: ${result.error}`
        : `Cleared ${result.cleared} old readings, inserted ${result.inserted} from ArcGIS, live: ${result.live_saved}`,
    });
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

// ── Alert history ──────────────────────────────────────────────────────

export function getAlertsData(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { severity, status, alert_type } = req.query;

    const result = getAlerts({ page, limit, severity, status, alert_type });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
}

// ── Prediction Simulation (for panel demo) ─────────────────────────────
// Accepts manual model inputs, sends them directly to Edge Gateway,
// returns the prediction without touching real sensor data.

function getLatestFromTable(table, columns = '*') {
  try {
    return disasterDb.prepare(`SELECT ${columns} FROM ${table} ORDER BY id DESC LIMIT 1`).get() || null;
  } catch { return null; }
}

function toNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function getLatestSimulationInputs() {
  const gps = getLatestFromTable('gps_readings', 'latitude, longitude, altitude');
  const rainfall = getLatestFromTable('rainfall_readings', 'rain_analog');
  const wl = getLatestFromTable('water_level_readings', 'water_level, alert_level, minor_flood_level, major_flood_level');
  const hs = getLatestFromTable('hydrospatial_data', 'elevation, river_distance');

  return {
    rainfall_mm: toNum(rainfall?.rain_analog, 0),
    latitude: toNum(gps?.latitude, 0),
    longitude: toNum(gps?.longitude, 0),
    elevation_m: toNum(hs?.elevation ?? gps?.altitude, 10),
    river_distance_km: toNum(hs?.river_distance, 1),
    water_level_m: toNum(wl?.water_level, 0),
    gauge_alert_level: toNum(wl?.alert_level, 2.0),
    gauge_minor_level: toNum(wl?.minor_flood_level, 3.0),
    gauge_major_level: toNum(wl?.major_flood_level, 5.0),
  };
}

const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

export async function getSimulatedPrediction(req, res) {
  try {
    const {
      rainfall_mm,
      latitude,
      longitude,
      elevation_m,
      river_distance_km,
      water_level_m,
      gauge_alert_level,
      gauge_minor_level,
      gauge_major_level,
      enabled_fields = [],
    } = req.body || {};

    // Read live sensor data for fields not enabled by the user
    const live = getLatestSimulationInputs();

    // Merge: use user value if field is enabled, otherwise use live sensor data
    const merged = {
      rainfall_mm: enabled_fields.includes('rainfall_mm') ? Number(rainfall_mm) : live.rainfall_mm,
      latitude: enabled_fields.includes('latitude') ? Number(latitude) : live.latitude,
      longitude: enabled_fields.includes('longitude') ? Number(longitude) : live.longitude,
      elevation_m: enabled_fields.includes('elevation_m') ? Number(elevation_m) : live.elevation_m,
      river_distance_km: enabled_fields.includes('river_distance_km') ? Number(river_distance_km) : live.river_distance_km,
      water_level_m: enabled_fields.includes('water_level_m') ? Number(water_level_m) : live.water_level_m,
      gauge_alert_level: enabled_fields.includes('gauge_alert_level') ? Number(gauge_alert_level) : live.gauge_alert_level,
      gauge_minor_level: enabled_fields.includes('gauge_minor_level') ? Number(gauge_minor_level) : live.gauge_minor_level,
      gauge_major_level: enabled_fields.includes('gauge_major_level') ? Number(gauge_major_level) : live.gauge_major_level,
    };

    // Validate required fields
    if (merged.latitude === 0 && merged.longitude === 0) {
      return res.status(400).json({ status: 'error', error: 'latitude and longitude are required (enable Location fields or ensure GPS is active)' });
    }

    // When lat/lon are simulated, fetch live hydrospatial data for that location
    // (nearest river, gauge station, elevation) to give accurate prediction context
    let hydrospatialData = null;
    const locationSimulated = enabled_fields.includes('latitude') || enabled_fields.includes('longitude');
    if (locationSimulated) {
      try {
        const alt = merged.elevation_m || 10;
        const hsUrl = `${EDGE_API}/hydrospatial/analysis?lat=${merged.latitude}&lon=${merged.longitude}&alt=${alt}`;
        logger.info(`[SIM] Fetching hydrospatial data for simulated location (${merged.latitude}, ${merged.longitude})`);
        const hsResponse = await fetch(hsUrl, { signal: AbortSignal.timeout(30_000) });
        if (hsResponse.ok) {
          hydrospatialData = await hsResponse.json();
          // Update merged values with live hydrospatial data
          if (hydrospatialData.camp_elevation != null) {
            merged.elevation_m = hydrospatialData.camp_elevation;
          }
          if (hydrospatialData.gauge_distance_km != null) {
            merged.river_distance_km = hydrospatialData.gauge_distance_km;
          }
          if (hydrospatialData.gauge_alert_level != null) {
            merged.gauge_alert_level = hydrospatialData.gauge_alert_level;
          }
          if (hydrospatialData.gauge_minor_level != null) {
            merged.gauge_minor_level = hydrospatialData.gauge_minor_level;
          }
          if (hydrospatialData.gauge_major_level != null) {
            merged.gauge_major_level = hydrospatialData.gauge_major_level;
          }
          // Use live water level from gauge if available
          if (hydrospatialData.live_gauge_data?.water_level != null) {
            merged.water_level_m = hydrospatialData.live_gauge_data.water_level;
          }
          // Use live rainfall from gauge if available
          if (hydrospatialData.live_gauge_data?.rainfall != null) {
            merged.rainfall_mm = hydrospatialData.live_gauge_data.rainfall;
          }
          logger.info(`[SIM] Hydrospatial data fetched: elevation=${merged.elevation_m}m, river=${merged.river_distance_km}km, water_level=${merged.water_level_m}m`);
        } else {
          logger.warn(`[SIM] Hydrospatial fetch failed: ${hsResponse.status}`);
        }
      } catch (hsErr) {
        logger.warn(`[SIM] Hydrospatial fetch error: ${hsErr.message}`);
      }
    }

    // Map to Edge Gateway format
    const edgeInputs = {
      rainfall_mm: merged.rainfall_mm,
      longitude: merged.longitude,
      latitude: merged.latitude,
      altitude_m: merged.elevation_m,
      dem_elevation_m: merged.elevation_m,
      nearest_river_m: merged.river_distance_km * 1000,
      water_level_m: merged.water_level_m,
      is_forecast: true,
      gauge_alert_level: merged.gauge_alert_level,
      gauge_minor_level: merged.gauge_minor_level,
      gauge_major_level: merged.gauge_major_level,
      return_shap: true,
    };

    // Call Edge Gateway predict-local endpoint (bypasses external API fetches)
    const url = `${EDGE_API}/hydrospatial/predict-local`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edgeInputs),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Edge Gateway returned ${response.status}: ${body.substring(0, 200)}`);
    }

    const edgeResult = await response.json();
    const pred = edgeResult.prediction || edgeResult;

    const completedAt = new Date().toISOString();

    const result = {
      status: 'success',
      mode: 'simulation',
      simulation: {
        simulated_fields: enabled_fields,
        live_fields: Object.keys(merged).filter(k => !enabled_fields.includes(k)),
        hydrospatial_fetched: locationSimulated && hydrospatialData != null,
      },
      prediction: {
        flood_probability: pred.probability ?? 0,
        flood_probability_percent: Math.round((pred.probability ?? 0) * 100),
        occurrence: pred.flood_possibility ?? 'Unknown',
        risk_category: pred.category ?? 'Unknown',
        forecast_hours: pred.future_forecast?.enabled ? 6 : 0,
        future_forecast: pred.future_forecast ?? null,
        source: pred.source ?? 'xgboost',
        shap_values: pred.shap_values ?? null,
      },
      inputs: {
        rainfall_mm: merged.rainfall_mm,
        latitude: merged.latitude,
        longitude: merged.longitude,
        elevation_m: merged.elevation_m,
        river_distance_km: merged.river_distance_km,
        water_level_m: merged.water_level_m,
        gauge_alert_level: merged.gauge_alert_level,
        gauge_minor_level: merged.gauge_minor_level,
        gauge_major_level: merged.gauge_major_level,
      },
      hydrospatial: hydrospatialData ? {
        river_name: hydrospatialData.nearest_river?.name ?? hydrospatialData.river_name,
        station_name: hydrospatialData.station_name,
        gauge_elevation: hydrospatialData.gauge_elevation,
        elevation_difference: hydrospatialData.elevation_difference,
        gauge_distance_km: hydrospatialData.gauge_distance_km,
      } : (edgeResult.source_data || null),
      data_quality: {
        missing_fields: [],
        stale: false,
        data_timestamp: completedAt,
        validation_errors: [],
      },
      prediction_timestamp: completedAt,
      prediction_duration_ms: 0,
      alert_evaluation: null,
      error: null,
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
}
