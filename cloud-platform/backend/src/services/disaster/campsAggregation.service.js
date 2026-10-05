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
import { STATION_META } from '../../data/disaster/stationMeta.js';

const AGGREGATION_TTL_MS = 5_000;
const pendingAggregations = new Map();

/**
 * Derive camp status from current water level relative to alert thresholds,
 * overridden by active disaster alert severity when present.
 * Returns one of: critical, high, medium, stable, recovery.
 */
function deriveStatus(wl, alertL, minorL, majorL, alertSeverity) {
  // Start with water-level-based status
  let status;
  if (wl == null || alertL == null) {
    status = 'medium';
  } else {
    const w = Number(wl);
    const alert = Number(alertL);
    const minor = Number(minorL || alert + 1);
    const major = Number(majorL || minor + 1.5);

    if (w >= major) status = 'critical';
    else if (w >= minor) status = 'high';
    else if (w >= alert) status = 'medium';
    else if (w >= alert - 1.0) status = 'stable';
    else status = 'recovery';
  }

  // Override with alert severity if it indicates higher risk
  const SEVERITY_rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const STATUS_rank = { critical: 4, high: 3, medium: 2, stable: 1, recovery: 0 };

  if (alertSeverity && SEVERITY_rank[alertSeverity] > STATUS_rank[status]) {
    if (alertSeverity === 'CRITICAL') status = 'critical';
    else if (alertSeverity === 'HIGH') status = 'high';
  }

  return status;
}

/**
 * Look up station metadata by station_id.
 * Returns { alertL, minorL, majorL, gauLat, gauLng, stDist, upDist, river, waterPath, type, capacity }
 * or null if station is unknown.
 */
function getStationMeta(stationId) {
  if (!stationId) return null;
  return STATION_META[stationId] || null;
}

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
 * Coerces numeric values to proper JS types (pg driver returns REAL as strings).
 */
const INTEGER_FIELDS = new Set(['hum', 'max_wind', 'cloud', 'elev', 'displaced', 'workers', 'aid', 'capacity', 'st_dist', 'up_dist']);

function guardedSet(updates, field, sourceValue, sourceTime, currentTime) {
  if (sourceValue == null || sourceValue === '') return;
  if (!isSourceNewer(sourceTime, currentTime)) return;
  if (INTEGER_FIELDS.has(field)) {
    updates[field] = Math.round(Number(sourceValue));
  } else if (typeof sourceValue === 'string' && !isNaN(sourceValue)) {
    updates[field] = Number(sourceValue);
  } else {
    updates[field] = sourceValue;
  }
}

// ── Core aggregation logic ────────────────────────────────────────────

/**
 * Aggregate latest valid source data into the CAMPS table for a single camp.
 *
 * If the CAMPS row doesn't exist, creates it from source data.
 * If it exists, updates only fields with newer, non-null source values.
 *
 * Uses a PostgreSQL transaction to ensure atomicity.
 */
async function aggregateCamp(campId) {
  const pool = getPool();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current CAMPS row (lock it)
    const currentResult = await client.query(
      `SELECT * FROM "CAMPS" WHERE id = $1 FOR UPDATE`,
      [campId],
    );

    const isNew = currentResult.rowCount === 0;
    const current = isNew ? null : currentResult.rows[0];

    // Resolve device_ids for this camp
    const deviceResult = await client.query(
      `SELECT device_id FROM devices WHERE camp_id = $1`,
      [campId],
    );
    const deviceIds = deviceResult.rows.map((r) => r.device_id);

    const now = new Date();

    // ── Collect latest values from all source tables ────────────────
    const gps = await getLatestGps(client, deviceIds);
    const env = await getLatestEnvironmental(client, deviceIds);
    const wl = await getLatestWaterLevel(client, deviceIds);
    const weather = await getLatestWeather(client, deviceIds);
    const flood = await getLatestFloodPrediction(client, deviceIds);
    const hydro = await getLatestHydrospatial(client, deviceIds);
    const rainSensor = await getLatestSensorByType(client, deviceIds, 'rainfall');
    const windSensor = await getLatestSensorByType(client, deviceIds, 'wind_speed');
    const displaced = await getDisplacedCount(client, deviceIds);
    const alert = await getLatestAlert(client, campId);

    // ── Determine effective values ──────────────────────────────────
    // For new records, use all available source data directly.
    // For existing records, apply freshness guards.
    const vals = {};

    if (isNew) {
      // Create new: take whatever is available from source
      const stationMeta = getStationMeta(wl?.station_id);
      vals.lat = gps?.latitude != null ? Number(gps.latitude) : null;
      vals.lng = gps?.longitude != null ? Number(gps.longitude) : null;
      vals.rain = rainSensor?.value != null ? Number(rainSensor.value) : env?.rainfall != null ? Number(env.rainfall) : null;
      vals.wl = wl?.water_level != null ? Number(wl.water_level) : null;
      vals.station = wl?.station_id ?? null;
      vals.min_t = weather?.temperature != null ? Number(weather.temperature) : null;
      vals.max_t = weather?.temperature != null ? Number(weather.temperature) : null;
      vals.hum = weather?.humidity != null ? Math.round(Number(weather.humidity)) : null;
      vals.precip = weather?.precipitation != null ? Number(weather.precipitation) : null;
      vals.max_wind = windSensor?.value != null ? Math.round(Number(windSensor.value)) : weather?.wind_speed != null ? Math.round(Number(weather.wind_speed)) : null;
      vals.cloud = flood?.flood_probability ? Math.round(Number(flood.flood_probability) * 100) : null;
      vals.elev = hydro?.elevation != null ? Math.round(Number(hydro.elevation)) : null;
      vals.river = hydro?.river_name ?? stationMeta?.river ?? null;
      vals.displaced = displaced ?? 0;
      vals.type = stationMeta?.type ?? 'FLOOD';
      vals.capacity = stationMeta?.capacity ?? 100;
      vals.code = campId.slice(0, 3).toUpperCase();
      vals.name = `Camp ${campId}`;

      // Water gauging station fields
      if (stationMeta) {
        vals.alert_l = stationMeta.alertL;
        vals.minor_l = stationMeta.minorL;
        vals.major_l = stationMeta.majorL;
        vals.gau_lat = stationMeta.gauLat;
        vals.gau_lng = stationMeta.gauLng;
        vals.st_dist = stationMeta.stDist;
        vals.up_dist = stationMeta.upDist;
        vals.water_path = stationMeta.waterPath;
      }

      // Derive status from water level vs alert thresholds, overridden by active alert severity
      vals.status = deriveStatus(vals.wl, vals.alert_l, vals.minor_l, vals.major_l, alert?.severity);
      vals.workers = 0;
      vals.aid = 0;

      // Insert new CAMPS row
      const fields = Object.keys(vals).filter((k) => vals[k] != null);
      const colList = fields.map((f) => `"${f}"`).join(', ');
      const valList = fields.map((_, i) => `$${i + 1}`).join(', ');
      const params = fields.map((f) => vals[f]);

      params.push(now, now, now, campId);
      await client.query(
        `INSERT INTO "CAMPS" (${colList}, last_aggregation_at, created_at, updated_at, id)
         VALUES (${valList}, $${fields.length + 1}, $${fields.length + 2}, $${fields.length + 3}, $${fields.length + 4})`,
        params,
      );

      await client.query('COMMIT');
      console.log(`[Aggregation] Camp ${campId} CREATED from source data`);
      return { updated: true, created: true, fields: fields, campId };
    }

    // ── Existing record: apply freshness guards ─────────────────────
    const updates = {};
    const t = current.updated_at;

    if (gps) {
      guardedSet(updates, 'lat', gps.latitude, gps.recorded_at, t);
      guardedSet(updates, 'lng', gps.longitude, gps.recorded_at, t);
    }
    if (env) {
      guardedSet(updates, 'rain', env.rainfall, env.recorded_at, t);
    }
    if (wl) {
      guardedSet(updates, 'wl', wl.water_level, wl.recorded_at, t);
      guardedSet(updates, 'station', wl.station_id, wl.recorded_at, t);

      // Update station metadata when station changes
      const stationMeta = getStationMeta(wl.station_id);
      if (stationMeta) {
        guardedSet(updates, 'alert_l', stationMeta.alertL, wl.recorded_at, t);
        guardedSet(updates, 'minor_l', stationMeta.minorL, wl.recorded_at, t);
        guardedSet(updates, 'major_l', stationMeta.majorL, wl.recorded_at, t);
        guardedSet(updates, 'gau_lat', stationMeta.gauLat, wl.recorded_at, t);
        guardedSet(updates, 'gau_lng', stationMeta.gauLng, wl.recorded_at, t);
        guardedSet(updates, 'st_dist', stationMeta.stDist, wl.recorded_at, t);
        guardedSet(updates, 'up_dist', stationMeta.upDist, wl.recorded_at, t);
        guardedSet(updates, 'water_path', stationMeta.waterPath, wl.recorded_at, t);
        if (!current.river) guardedSet(updates, 'river', stationMeta.river, wl.recorded_at, t);
      }
    }
    if (weather) {
      const wt = weather.forecast_time || weather.created_at;
      guardedSet(updates, 'min_t', weather.temperature, wt, t);
      guardedSet(updates, 'max_t', weather.temperature, wt, t);
      guardedSet(updates, 'hum', weather.humidity, wt, t);
      guardedSet(updates, 'precip', weather.precipitation, wt, t);
      guardedSet(updates, 'max_wind', weather.wind_speed, wt, t);
    }
    if (flood) {
      guardedSet(updates, 'cloud', flood.flood_probability ? Math.round(Number(flood.flood_probability) * 100) : null, flood.predicted_at, t);
    }
    if (hydro) {
      guardedSet(updates, 'elev', hydro.elevation, hydro.created_at, t);
      guardedSet(updates, 'river', hydro.river_name, hydro.created_at, t);
    }
    if (rainSensor) {
      guardedSet(updates, 'rain', rainSensor.value, rainSensor.recorded_at, t);
    }
    if (windSensor) {
      guardedSet(updates, 'max_wind', windSensor.value, windSensor.recorded_at, t);
    }
    if (displaced != null) {
      guardedSet(updates, 'displaced', displaced, now, t);
    }

    // Re-derive status from latest water level, alert thresholds, and active alert severity
    const effectiveWl = updates.wl ?? current.wl;
    const effectiveAlertL = updates.alert_l ?? current.alert_l;
    const effectiveMinorL = updates.minor_l ?? current.minor_l;
    const effectiveMajorL = updates.major_l ?? current.major_l;
    const newStatus = deriveStatus(effectiveWl, effectiveAlertL, effectiveMinorL, effectiveMajorL, alert?.severity);
    if (newStatus !== current.status) {
      updates.status = newStatus;
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
