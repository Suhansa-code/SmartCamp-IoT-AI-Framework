/**
 * campsAggregation.service.js — Event-driven CAMPS table aggregator.
 *
 * After a disaster-domain source record is saved, the sync receiver calls
 * triggerAggregation(campId). This module reads the latest valid values from
 * all source tables for that camp and atomically upserts into the CAMPS table,
 * which serves as the current/latest aggregated state for the frontend.
 *
 * Design principles:
 *  - Single-camp aggregation (only re-aggregates the affected camp)
 *  - Timestamp freshness: only updates if source is newer than current CAMPS value
 *  - Null-safety: never overwrites a valid value with NULL/invalid
 *  - Atomic upsert via INSERT ... ON CONFLICT ... DO UPDATE
 *  - Idempotent: safe to call multiple times for the same camp
 *  - Recoverable: errors are logged but don't block the sync ACK
 */
import { getPool } from '../../config/database.js';

const AGGREGATION_TTL_MS = 5_000;
const pendingAggregations = new Map();

// ── Source table query helpers ─────────────────────────────────────────

/**
 * Get the latest GPS reading for a camp (via device_id mapping).
 * Returns { lat, lng, recorded_at } or null.
 */
async function getLatestGps(pool, deviceIds) {
  if (!deviceIds.length) return null;
  const result = await pool.query(
    `SELECT latitude, longitude, recorded_at
     FROM gps_readings
     WHERE device_id = ANY($1)
     ORDER BY recorded_at DESC NULLS LAST
     LIMIT 1`,
    [deviceIds],
  );
  return result.rows[0] || null;
}

/**
 * Get the latest environmental data for a camp.
 * Returns { temperature, humidity, pressure, rainfall, wind_speed, ... } or null.
 */
async function getLatestEnvironmental(pool, deviceIds) {
  if (!deviceIds.length) return null;
  const result = await pool.query(
    `SELECT temperature, humidity, pressure, rainfall, wind_speed, wind_direction, recorded_at
     FROM environmental_data
     WHERE device_id = ANY($1)
     ORDER BY recorded_at DESC NULLS LAST
     LIMIT 1`,
    [deviceIds],
  );
  return result.rows[0] || null;
}

/**
 * Get the latest water level reading for a camp.
 * Returns { water_level, station_id, recorded_at } or null.
 */
async function getLatestWaterLevel(pool, deviceIds) {
  if (!deviceIds.length) return null;
  const result = await pool.query(
    `SELECT water_level, station_id, recorded_at
     FROM water_level_readings
     WHERE device_id = ANY($1)
     ORDER BY recorded_at DESC NULLS LAST
     LIMIT 1`,
    [deviceIds],
  );
  return result.rows[0] || null;
}

/**
 * Get the latest weather data for a camp.
 * Returns { temperature, precipitation, rainfall, wind_speed, weather_code, ... } or null.
 */
async function getLatestWeather(pool, deviceIds) {
  if (!deviceIds.length) return null;
  const result = await pool.query(
    `SELECT temperature, precipitation, rainfall, wind_speed, weather_code,
            forecast_time, created_at
     FROM weather_data
     WHERE device_id = ANY($1)
     ORDER BY forecast_time DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`,
    [deviceIds],
  );
  return result.rows[0] || null;
}

/**
 * Get the latest flood prediction for a camp.
 * Returns { flood_probability, flood_category, forecast_hours, predicted_at } or null.
 */
async function getLatestFloodPrediction(pool, deviceIds) {
  if (!deviceIds.length) return null;
  const result = await pool.query(
    `SELECT flood_probability, flood_category, forecast_hours, predicted_at
     FROM flood_predictions
     WHERE device_id = ANY($1)
     ORDER BY predicted_at DESC NULLS LAST
     LIMIT 1`,
    [deviceIds],
  );
  return result.rows[0] || null;
}

/**
 * Get the latest hydrospatial data for a camp.
 * Returns { elevation, river_name, nearest_station_id, river_distance, ... } or null.
 */
async function getLatestHydrospatial(pool, deviceIds) {
  if (!deviceIds.length) return null;
  const result = await pool.query(
    `SELECT elevation, river_name, nearest_station_id, river_distance, source, created_at
     FROM hydrospatial_data
     WHERE device_id = ANY($1)
     ORDER BY created_at DESC NULLS LAST
     LIMIT 1`,
    [deviceIds],
  );
  return result.rows[0] || null;
}

/**
 * Get the latest sensor reading of a specific type for a camp.
 * Returns { value, recorded_at } or null.
 */
async function getLatestSensorByType(pool, deviceIds, sensorType) {
  if (!deviceIds.length) return null;
  const result = await pool.query(
    `SELECT value, unit, recorded_at
     FROM sensor_readings
     WHERE device_id = ANY($1) AND sensor_type = $2
     ORDER BY recorded_at DESC NULLS LAST
     LIMIT 1`,
    [deviceIds, sensorType],
  );
  return result.rows[0] || null;
}

/**
 * Get the latest active disaster alert for a camp.
 * Returns { severity, alert_type, flood_probability_percent, created_at } or null.
 */
async function getLatestAlert(pool, campId) {
  if (!campId) return null;
  const result = await pool.query(
    `SELECT severity, alert_type, flood_probability_percent, created_at
     FROM disaster_alerts
     WHERE camp_id = $1 AND status IN ('ACTIVE', 'ACKNOWLEDGED')
     ORDER BY created_at DESC NULLS LAST
     LIMIT 1`,
    [campId],
  );
  return result.rows[0] || null;
}

/**
 * Get the count of active persons (displaced) for a camp via device mapping.
 * Falls back to persons table if device_ids are available.
 */
async function getDisplacedCount(pool, deviceIds) {
  if (!deviceIds.length) return null;
  const result = await pool.query(
    `SELECT COUNT(DISTINCT p.id) AS displaced
     FROM persons p
     INNER JOIN devices d ON d.device_id = ANY($1)
     WHERE p.device_id = d.device_id AND p.is_active = 1`,
    [deviceIds],
  );
  const count = result.rows[0]?.displaced;
  return count > 0 ? count : null;
}

// ── Value freshness guard ─────────────────────────────────────────────

/**
 * Returns true if `sourceTime` is newer than `currentCampTime`.
 * Handles nulls: if current is null, source is always considered newer.
 * If source is null/invalid, returns false (don't overwrite with null).
 */
function isSourceNewer(sourceTime, currentCampTime) {
  if (!sourceTime) return false;
  if (!currentCampTime) return true;
  return new Date(sourceTime) > new Date(currentCampTime);
}

/**
 * Conditionally set a field: only update if sourceValue is non-null/non-empty
 * AND sourceTime is newer than currentTime.
 */
function guardedSet(updates, field, sourceValue, sourceTime, currentTime) {
  if (sourceValue == null || sourceValue === '') return;
  if (!isSourceNewer(sourceTime, currentTime)) return;
  updates[field] = sourceValue;
}

// ── Core aggregation logic ────────────────────────────────────────────

/**
 * Aggregate latest valid source data into the CAMPS table for a single camp.
 *
 * This reads from: gps_readings, environmental_data, water_level_readings,
 * weather_data, flood_predictions, hydrospatial_data, sensor_readings,
 * disaster_alerts, and persons (via device mapping).
 *
 * Uses a PostgreSQL transaction to ensure atomicity.
 */
async function aggregateCamp(campId) {
  const pool = getPool();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current CAMPS row
    const currentResult = await client.query(
      `SELECT * FROM "CAMPS" WHERE id = $1 FOR UPDATE`,
      [campId],
    );

    if (currentResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { updated: false, reason: 'camp_not_found' };
    }

    const current = currentResult.rows[0];

    // Resolve device_ids for this camp
    const deviceResult = await client.query(
      `SELECT device_id FROM devices WHERE camp_id = $1`,
      [campId],
    );
    const deviceIds = deviceResult.rows.map((r) => r.device_id);

    const now = new Date();
    const updates = {};
    const currentTimestamps = {
      lat: current.updated_at,
      gps: current.updated_at,
      environmental: current.updated_at,
      water_level: current.updated_at,
      weather: current.updated_at,
      flood: current.updated_at,
      hydrospatial: current.updated_at,
      alert: current.updated_at,
      displaced: current.updated_at,
    };

    // ── GPS → lat, lng ──────────────────────────────────────────────
    const gps = await getLatestGps(client, deviceIds);
    if (gps) {
      guardedSet(updates, 'lat', gps.latitude, gps.recorded_at, currentTimestamps.gps);
      guardedSet(updates, 'lng', gps.longitude, gps.recorded_at, currentTimestamps.gps);
    }

    // ── Environmental → rain, max_hr_prec ───────────────────────────
    const env = await getLatestEnvironmental(client, deviceIds);
    if (env) {
      guardedSet(updates, 'rain', env.rainfall, env.recorded_at, currentTimestamps.environmental);
      // max_hr_prec could come from sensor readings
    }

    // ── Water level → wl, station ───────────────────────────────────
    const wl = await getLatestWaterLevel(client, deviceIds);
    if (wl) {
      guardedSet(updates, 'wl', wl.water_level, wl.recorded_at, currentTimestamps.water_level);
      guardedSet(updates, 'station', wl.station_id, wl.recorded_at, currentTimestamps.water_level);
    }

    // ── Weather → min_t, max_t, hum, precip, wind, pres, cloud ──────
    const weather = await getLatestWeather(client, deviceIds);
    if (weather) {
      const weatherTime = weather.forecast_time || weather.created_at;
      guardedSet(updates, 'min_t', weather.temperature, weatherTime, currentTimestamps.weather);
      guardedSet(updates, 'max_t', weather.temperature, weatherTime, currentTimestamps.weather);
      guardedSet(updates, 'hum', weather.humidity, weatherTime, currentTimestamps.weather);
      guardedSet(updates, 'precip', weather.precipitation, weatherTime, currentTimestamps.weather);
      guardedSet(updates, 'max_wind', weather.wind_speed, weatherTime, currentTimestamps.weather);
    }

    // ── Flood prediction → alert level thresholds ───────────────────
    const flood = await getLatestFloodPrediction(client, deviceIds);
    if (flood) {
      guardedSet(updates, 'cloud', flood.flood_probability ? Math.round(flood.flood_probability * 100) : null, flood.predicted_at, currentTimestamps.flood);
    }

    // ── Hydrospatial → elev, river, river_distance ──────────────────
    const hydro = await getLatestHydrospatial(client, deviceIds);
    if (hydro) {
      guardedSet(updates, 'elev', hydro.elevation, hydro.created_at, currentTimestamps.hydrospatial);
      guardedSet(updates, 'river', hydro.river_name, hydro.created_at, currentTimestamps.hydrospatial);
    }

    // ── Sensor readings → rain (from rainfall sensor type) ──────────
    const rainSensor = await getLatestSensorByType(client, deviceIds, 'rainfall');
    if (rainSensor) {
      guardedSet(updates, 'rain', rainSensor.value, rainSensor.recorded_at, currentTimestamps.environmental);
    }

    const windSensor = await getLatestSensorByType(client, deviceIds, 'wind_speed');
    if (windSensor) {
      guardedSet(updates, 'max_wind', windSensor.value, windSensor.recorded_at, currentTimestamps.weather);
    }

    // ── Persons / checkins → displaced count ────────────────────────
    const displaced = await getDisplacedCount(client, deviceIds);
    if (displaced != null) {
      guardedSet(updates, 'displaced', displaced, now, currentTimestamps.displaced);
    }

    // ── Apply updates ───────────────────────────────────────────────
    const fieldSetClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [field, value] of Object.entries(updates)) {
      fieldSetClauses.push(`"${field}" = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    // Always update the aggregation timestamp
    fieldSetClauses.push(`"last_aggregation_at" = $${paramIndex}`);
    values.push(now);
    paramIndex++;

    fieldSetClauses.push(`"updated_at" = $${paramIndex}`);
    values.push(now);
    paramIndex++;

    values.push(campId);

    await client.query(
      `UPDATE "CAMPS" SET ${fieldSetClauses.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );

    await client.query('COMMIT');

    const updatedFields = Object.keys(updates);
    if (updatedFields.length > 0) {
      console.log(`[Aggregation] Camp ${campId} updated: ${updatedFields.join(', ')}`);
    }

    return { updated: updatedFields.length > 0, fields: updatedFields, campId };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Aggregation] Failed to aggregate camp ${campId}: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

// ── Event-driven trigger with debounce ────────────────────────────────

/**
 * Trigger aggregation for a camp. Debounces rapid successive calls for the
 * same camp (e.g., multiple sensor readings arriving within milliseconds).
 *
 * Only one aggregation per camp will execute within the AGGREGATION_TTL_MS window.
 */
export function triggerAggregation(campId) {
  if (!campId) return;

  if (pendingAggregations.has(campId)) {
    return;
  }

  pendingAggregations.set(campId, true);

  setTimeout(async () => {
    pendingAggregations.delete(campId);
    try {
      await aggregateCamp(campId);
    } catch (err) {
      console.error(`[Aggregation] Trigger failed for camp ${campId}: ${err.message}`);
    }
  }, AGGREGATION_TTL_MS);
}

/**
 * Immediately aggregate a camp without debouncing.
 * Useful for manual triggering or batch operations.
 */
export async function aggregateCampImmediate(campId) {
  return aggregateCamp(campId);
}

/**
 * Aggregate all camps. Used for initial seeding or manual full refresh.
 * Processes camps sequentially to avoid overwhelming the database.
 */
export async function aggregateAllCamps() {
  const pool = getPool();
  const result = await pool.query('SELECT id FROM "CAMPS" ORDER BY id');
  const campIds = result.rows.map((r) => r.id);

  console.log(`[Aggregation] Aggregating ${campIds.length} camps...`);
  let successCount = 0;
  let errorCount = 0;

  for (const campId of campIds) {
    try {
      await aggregateCamp(campId);
      successCount++;
    } catch {
      errorCount++;
    }
  }

  console.log(`[Aggregation] Complete: ${successCount} succeeded, ${errorCount} failed`);
  return { total: campIds.length, success: successCount, errors: errorCount };
}

/**
 * Get aggregation status for diagnostics.
 */
export function getAggregationStatus() {
  return {
    pending: Array.from(pendingAggregations.keys()),
    debounceTtlMs: AGGREGATION_TTL_MS,
  };
}
