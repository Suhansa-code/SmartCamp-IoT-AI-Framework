/**
 * prediction-service.js — Gathers latest sensor + hydro-spatial data from
 * disaster.db, assembles the XGBoost feature vector, and calls the Edge
 * Gateway prediction endpoint.
 *
 * Supports LIVE and SIMULATION modes via environment variables.
 * Simulation overrides never touch the database.
 *
 * Writes prediction results to flood_predictions and prediction_requests tables.
 */
import { disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import crypto from 'crypto';

const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

// ── Simulation config ──────────────────────────────────────────────────
const SIM_ENABLED = process.env.FLOOD_SIMULATION_ENABLED === 'true';
const SIM_RAINFALL = process.env.FLOOD_SIMULATION_RAINFALL;
const SIM_LATITUDE = process.env.FLOOD_SIMULATION_LATITUDE;
const SIM_LONGITUDE = process.env.FLOOD_SIMULATION_LONGITUDE;
const SIM_ELEVATION = process.env.FLOOD_SIMULATION_ELEVATION;
const SIM_RIVER_DISTANCE = process.env.FLOOD_SIMULATION_RIVER_DISTANCE_KM;
const SIM_WATER_LEVEL = process.env.FLOOD_SIMULATION_WATER_LEVEL;

// ── XGBoost model feature set (must match base_model.py exactly) ──────
// Model features: rainfall_7d_mm, longitude, latitude, elevation_m, distance_to_river_m
// Model inputs:   rainfall_mm, longitude, latitude, altitude_m, dem_elevation_m,
//                 nearest_river_m, gauging_station_current_water_level_m, is_forecast

// ── Data freshness threshold ───────────────────────────────────────────
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Prepared statements for DB writes ──────────────────────────────────
let insertPredictionRequestStmt = null;
let updatePredictionRequestStmt = null;
let insertFloodPredictionStmt = null;

function ensureStatements() {
  if (insertPredictionRequestStmt) return;

  insertPredictionRequestStmt = disasterDb.prepare(`
    INSERT INTO prediction_requests (request_id, request_type, input_data, status, requested_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  updatePredictionRequestStmt = disasterDb.prepare(`
    UPDATE prediction_requests SET status = ?, response_data = ?, completed_at = ? WHERE request_id = ?
  `);

  insertFloodPredictionStmt = disasterDb.prepare(`
    INSERT INTO flood_predictions (prediction_id, latitude, longitude, rainfall, elevation, river_distance, flood_probability, flood_category, forecast_hours, model_version, predicted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
}

// ── Helpers ────────────────────────────────────────────────────────────

function toNumber(val, fallback = null) {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function getLatestFromTable(table, columns = '*') {
  try {
    return disasterDb.prepare(`SELECT ${columns} FROM ${table} ORDER BY id DESC LIMIT 1`).get() || null;
  } catch (err) {
    logger.warn(`[PREDICTION] Failed to read ${table}: ${err.message}`);
    return null;
  }
}

// ── Gather latest data from disaster.db ────────────────────────────────

function gatherLatestInputs() {
  const result = {
    gps: null,
    rainfall: null,
    waterLevel: null,
    hydrospatial: null,
    dataTimestamp: null,
    missingFields: [],
    stale: false,
  };

  // GPS (latitude, longitude, altitude)
  const gps = getLatestFromTable('gps_readings', 'latitude, longitude, altitude, recorded_at');
  if (gps && gps.latitude != null && gps.longitude != null) {
    result.gps = {
      latitude: toNumber(gps.latitude),
      longitude: toNumber(gps.longitude),
      altitude: toNumber(gps.altitude, 10.0),
      recorded_at: gps.recorded_at,
    };
  } else {
    result.missingFields.push('gps');
  }

  // Rainfall (mm)
  const rainfall = getLatestFromTable('rainfall_readings', 'rain_analog, recorded_at');
  if (rainfall && rainfall.rain_analog != null) {
    result.rainfall = {
      mm: toNumber(rainfall.rain_analog, 0),
      recorded_at: rainfall.recorded_at,
    };
  } else {
    result.missingFields.push('rainfall');
  }

  // Water level (for probability adjustment)
  const wl = getLatestFromTable('water_level_readings', 'water_level, alert_level, minor_flood_level, major_flood_level, recorded_at');
  if (wl && wl.water_level != null) {
    result.waterLevel = {
      water_level: toNumber(wl.water_level, 0),
      alert_level: toNumber(wl.alert_level),
      minor_flood_level: toNumber(wl.minor_flood_level),
      major_flood_level: toNumber(wl.major_flood_level),
      recorded_at: wl.recorded_at,
    };
  } else {
    result.missingFields.push('water_level');
  }

  // Hydrospatial (elevation, river distance, gauge info)
  const hs = getLatestFromTable('hydrospatial_data',
    'elevation, river_distance, river_name, gauge_elevation, elevation_difference, gauge_distance, gauge_latitude, gauge_longitude, station_name, created_at');
  if (hs && hs.elevation != null) {
    result.hydrospatial = {
      elevation: toNumber(hs.elevation),
      river_distance_km: toNumber(hs.river_distance),
      river_name: hs.river_name,
      gauge_elevation: toNumber(hs.gauge_elevation),
      elevation_difference: toNumber(hs.elevation_difference),
      gauge_distance_km: toNumber(hs.gauge_distance),
      gauge_latitude: toNumber(hs.gauge_latitude),
      gauge_longitude: toNumber(hs.gauge_longitude),
      station_name: hs.station_name,
      created_at: hs.created_at,
    };
  } else {
    result.missingFields.push('hydrospatial');
  }

  // Determine data freshness
  const timestamps = [
    result.gps?.recorded_at,
    result.rainfall?.recorded_at,
    result.waterLevel?.recorded_at,
    result.hydrospatial?.created_at,
  ].filter(Boolean).map(t => new Date(t).getTime()).filter(t => !isNaN(t));

  if (timestamps.length > 0) {
    const oldest = Math.min(...timestamps);
    result.dataTimestamp = new Date(oldest).toISOString();
    if (Date.now() - oldest > STALE_THRESHOLD_MS) {
      result.stale = true;
    }
  }

  return result;
}

// ── Build prediction inputs from gathered data ─────────────────────────

function buildPredictionInputs(data) {
  const { gps, rainfall, waterLevel, hydrospatial } = data;

  // Core model inputs
  const latitude = gps?.latitude ?? 0;
  const longitude = gps?.longitude ?? 0;
  const elevation = hydrospatial?.elevation ?? gps?.altitude ?? 10.0;
  const riverDistanceM = (hydrospatial?.river_distance_km ?? 0) * 1000;
  const rainfallMm = rainfall?.mm ?? 0;
  const waterLevelM = waterLevel?.water_level ?? 0;
  const altitude = gps?.altitude ?? 10.0;

  return {
    rainfall_mm: rainfallMm,
    longitude,
    latitude,
    altitude_m: altitude,
    dem_elevation_m: elevation,
    nearest_river_m: riverDistanceM,
    gauging_station_current_water_level_m: waterLevelM,
    is_forecast: true,
  };
}

// ── Apply simulation overrides ─────────────────────────────────────────

function applySimulationOverrides(inputs, data) {
  if (!SIM_ENABLED) return { inputs, overridden: [] };

  const overridden = [];

  if (SIM_RAINFALL !== undefined && SIM_RAINFALL !== '') {
    inputs.rainfall_mm = toNumber(SIM_RAINFALL, inputs.rainfall_mm);
    overridden.push('rainfall');
  }
  if (SIM_LATITUDE !== undefined && SIM_LATITUDE !== '') {
    inputs.latitude = toNumber(SIM_LATITUDE, inputs.latitude);
    overridden.push('latitude');
  }
  if (SIM_LONGITUDE !== undefined && SIM_LONGITUDE !== '') {
    inputs.longitude = toNumber(SIM_LONGITUDE, inputs.longitude);
    overridden.push('longitude');
  }
  if (SIM_ELEVATION !== undefined && SIM_ELEVATION !== '') {
    inputs.dem_elevation_m = toNumber(SIM_ELEVATION, inputs.dem_elevation_m);
    overridden.push('elevation');
  }
  if (SIM_RIVER_DISTANCE !== undefined && SIM_RIVER_DISTANCE !== '') {
    inputs.nearest_river_m = toNumber(SIM_RIVER_DISTANCE, 0) * 1000;
    overridden.push('river_distance');
  }
  if (SIM_WATER_LEVEL !== undefined && SIM_WATER_LEVEL !== '') {
    inputs.gauging_station_current_water_level_m = toNumber(SIM_WATER_LEVEL, inputs.gauging_station_current_water_level_m);
    overridden.push('water_level');
  }

  return { inputs, overridden };
}

// ── Call Edge Gateway prediction endpoint ───────────────────────────────

async function callEdgePrediction(inputs) {
  const params = new URLSearchParams({
    lat: String(inputs.latitude),
    lon: String(inputs.longitude),
    alt: String(inputs.altitude_m),
  });

  const url = `${EDGE_API}/hydrospatial/predict?${params}`;
  logger.info(`[PREDICTION] Calling Edge Gateway: ${url}`);

  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Edge Gateway returned ${response.status}: ${body.substring(0, 200)}`);
  }

  return response.json();
}

// ── Main prediction function ───────────────────────────────────────────

export async function getFloodPrediction() {
  const startTime = Date.now();
  const mode = SIM_ENABLED ? 'simulation' : 'live';
  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();

  ensureStatements();

  // Insert prediction request record
  try {
    insertPredictionRequestStmt.run(
      requestId,
      mode === 'simulation' ? 'SIMULATION' : 'LIVE',
      JSON.stringify({ mode, timestamp: now }),
      'PENDING',
      now,
    );
  } catch (err) {
    logger.warn(`[PREDICTION] Failed to insert prediction_request: ${err.message}`);
  }

  // Step 1: Gather latest data from disaster.db
  const data = gatherLatestInputs();

  // Step 2: Build prediction inputs
  let inputs = buildPredictionInputs(data);

  // Step 3: Apply simulation overrides if enabled
  const { inputs: finalInputs, overridden } = applySimulationOverrides(inputs, data);
  inputs = finalInputs;

  // Step 4: Validate inputs
  const validationErrors = [];
  if (inputs.latitude === 0 && inputs.longitude === 0) {
    validationErrors.push('GPS coordinates not available');
  }
  if (data.missingFields.includes('rainfall') && overridden.includes('rainfall') === false) {
    validationErrors.push('Rainfall data not available');
  }

  // Step 5: Call Edge Gateway prediction
  let prediction = null;
  let predictionError = null;

  try {
    const edgeResult = await callEdgePrediction(inputs);
    const pred = edgeResult.prediction || edgeResult;
    prediction = {
      flood_probability: pred.probability ?? 0,
      flood_probability_percent: Math.round((pred.probability ?? 0) * 100),
      occurrence: pred.flood_possibility ?? 'Unknown',
      risk_category: pred.category ?? 'Unknown',
      forecast_hours: pred.future_forecast?.enabled ? 6 : 0,
      future_forecast: pred.future_forecast ?? null,
      source: pred.source ?? 'xgboost',
    };
  } catch (err) {
    predictionError = err.message;
    logger.error(`[PREDICTION] Edge Gateway call failed: ${err.message}`);
  }

  const durationMs = Date.now() - startTime;
  const completedAt = new Date().toISOString();

  // Step 6: Write prediction result to flood_predictions table
  if (prediction) {
    try {
      const predictionId = crypto.randomUUID();
      insertFloodPredictionStmt.run(
        predictionId,
        inputs.latitude,
        inputs.longitude,
        inputs.rainfall_mm,
        inputs.dem_elevation_m,
        inputs.nearest_river_m / 1000,
        prediction.flood_probability,
        prediction.risk_category,
        prediction.forecast_hours,
        prediction.source,
        completedAt,
      );
      logger.info(`[PREDICTION] Saved flood_prediction: ${predictionId}`);
    } catch (err) {
      logger.warn(`[PREDICTION] Failed to insert flood_prediction: ${err.message}`);
    }
  }

  // Step 7: Update prediction request record
  try {
    const status = prediction ? 'COMPLETED' : 'FAILED';
    const responseData = prediction ? JSON.stringify(prediction) : JSON.stringify({ error: predictionError });
    updatePredictionRequestStmt.run(status, responseData, completedAt, requestId);
  } catch (err) {
    logger.warn(`[PREDICTION] Failed to update prediction_request: ${err.message}`);
  }

  // Step 8: Build response
  return {
    status: prediction ? 'success' : 'error',
    mode,
    simulation: mode === 'simulation' ? { overridden_fields: overridden } : undefined,
    prediction,
    inputs: {
      rainfall_mm: inputs.rainfall_mm,
      latitude: inputs.latitude,
      longitude: inputs.longitude,
      elevation_m: inputs.dem_elevation_m,
      river_distance_km: inputs.nearest_river_m / 1000,
      water_level_m: inputs.gauging_station_current_water_level_m,
    },
    hydrospatial: data.hydrospatial ? {
      gauge_elevation: data.hydrospatial.gauge_elevation,
      elevation_difference: data.hydrospatial.elevation_difference,
      gauge_distance_km: data.hydrospatial.gauge_distance_km,
      river_name: data.hydrospatial.river_name,
      station_name: data.hydrospatial.station_name,
      water_level: data.waterLevel?.water_level ?? null,
    } : null,
    data_quality: {
      missing_fields: data.missingFields,
      stale: data.stale,
      data_timestamp: data.dataTimestamp,
      validation_errors: validationErrors,
    },
    prediction_timestamp: completedAt,
    prediction_duration_ms: durationMs,
    error: predictionError,
  };
}
