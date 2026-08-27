#!/usr/bin/env node
/**
 * migrate-rpi-to-cloud.js — One-time migration: Raspberry Pi SQLite → Cloud PostgreSQL
 *
 * Usage:
 *   node scripts/migrate-rpi-to-cloud.js
 *
 * Reads from local SQLite databases (camp.db, disaster.db, pages.db)
 * and inserts into Cloud PostgreSQL using the existing sync repository functions.
 *
 * SAFE TO RUN MULTIPLE TIMES — uses ON CONFLICT upserts.
 * DOES NOT modify or delete any Raspberry Pi local records.
 *
 * After successful migration, this script should be deleted.
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration ────────────────────────────────────────────────────────

const DEVICE_ID = process.env.DEVICE_ID || 'SCB-UNIT-01';

// CAMP_ID is derived from the latest GPS reading in the RPi's SQLite database.
// Fallback: persisted camp-id.json → DEVICE_ID.
let CAMP_ID = DEVICE_ID; // resolved after DB open

function resolveCampId() {
  // 1. Try reading latest GPS location_name from RPi's disaster.db
  try {
    const gpsRow = disasterDb.prepare(
      'SELECT location_name FROM gps_readings WHERE location_name IS NOT NULL AND location_name != "" ORDER BY recorded_at DESC LIMIT 1'
    ).get();
    if (gpsRow?.location_name) {
      const first = gpsRow.location_name.trim().charAt(0);
      if (first && /[a-zA-Z]/.test(first)) {
        CAMP_ID = `CAMP-${first.toUpperCase()}`;
        console.log(`  CAMP_ID derived from GPS: ${CAMP_ID} (location: "${gpsRow.location_name}")`);
        return;
      }
    }
  } catch { /* gps_readings may not have location_name column */ }

  // 2. Fallback to persisted camp-id.json
  try {
    const statePath = path.join(__dirname, '../db/camp-id.json');
    if (existsSync(statePath)) {
      const data = JSON.parse(readFileSync(statePath, 'utf8'));
      if (data.camp_id) {
        CAMP_ID = data.camp_id;
        console.log(`  CAMP_ID loaded from disk: ${CAMP_ID}`);
        return;
      }
    }
  } catch { /* no persisted state */ }

  // 3. Final fallback: DEVICE_ID
  console.log(`  CAMP_ID fallback to DEVICE_ID: ${DEVICE_ID}`);
}

const CAMP_DB_PATH = process.env.CAMP_DB_PATH || path.join(__dirname, '../db/camp.db');
const DISASTER_DB_PATH = process.env.DISASTER_DB_PATH || path.join(__dirname, '../db/disaster.db');
const PAGES_DB_PATH = process.env.PAGES_DB_PATH || path.join(__dirname, '../db/pages.db');

const PG_CONFIG = (process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL)
  ? { connectionString: process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME || 'smartcamp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };

// ── Progress tracking ────────────────────────────────────────────────────

const results = {};

function record(table, count) {
  results[table] = count;
  if (count > 0) {
    console.log(`  ${table.padEnd(30)} ${String(count).padStart(6)} migrated`);
  }
}

// ── Database connections ─────────────────────────────────────────────────

let campDb, disasterDb, pagesDb, pgPool;

function openDatabases() {
  console.log(`Opening local databases...`);
  console.log(`  camp.db:     ${CAMP_DB_PATH}`);
  console.log(`  disaster.db: ${DISASTER_DB_PATH}`);
  console.log(`  pages.db:    ${PAGES_DB_PATH}`);

  campDb = new Database(CAMP_DB_PATH, { readonly: true });
  disasterDb = new Database(DISASTER_DB_PATH, { readonly: true });
  pagesDb = new Database(PAGES_DB_PATH, { readonly: true });

  // Resolve CAMP_ID from GPS data now that disaster.db is open
  resolveCampId();

  pgPool = new pg.Pool(PG_CONFIG);
}

async function closeDatabases() {
  if (campDb) campDb.close();
  if (disasterDb) disasterDb.close();
  if (pagesDb) pagesDb.close();
  if (pgPool) await pgPool.end();
}

// ── Helpers ──────────────────────────────────────────────────────────────

function nowISO() {
  return new Date().toISOString();
}

function parseTimestamp(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function parseIntOrNull(value) {
  if (value == null) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function parseFloatOrNull(value) {
  if (value == null) return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

// ── Upsert builders ──────────────────────────────────────────────────────

async function upsertBatch(pool, sql, rows) {
  if (rows.length === 0) return 0;
  const client = await pool.connect();
  let count = 0;
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      try {
        await client.query(sql, row);
        count++;
      } catch (err) {
        // Log but continue — upsert should handle duplicates
        if (!err.message.includes('duplicate key')) {
          console.error(`    Row insert error: ${err.message}`);
        }
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return count;
}

// ══════════════════════════════════════════════════════════════════════════
// MIGRATION: camp.db → Cloud PostgreSQL
// ══════════════════════════════════════════════════════════════════════════

async function migratePersons() {
  const rows = campDb.prepare('SELECT * FROM persons').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO persons (id,fingerprint_id,full_name,age,gender,family_unit_id,family_size,
      is_pregnant,has_chronic_illness,medical_notes,person_type,is_active,registration_date,
      mqtt_client_id,mqtt_password,created_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ON CONFLICT (id) DO UPDATE SET
      fingerprint_id=EXCLUDED.fingerprint_id, full_name=EXCLUDED.full_name,
      age=EXCLUDED.age, gender=EXCLUDED.gender, family_unit_id=EXCLUDED.family_unit_id,
      family_size=EXCLUDED.family_size, is_pregnant=EXCLUDED.is_pregnant,
      has_chronic_illness=EXCLUDED.has_chronic_illness, medical_notes=EXCLUDED.medical_notes,
      person_type=EXCLUDED.person_type, is_active=EXCLUDED.is_active,
      registration_date=EXCLUDED.registration_date, mqtt_client_id=EXCLUDED.mqtt_client_id,
      mqtt_password=EXCLUDED.mqtt_password, created_at=EXCLUDED.created_at,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.fingerprint_id, r.full_name, r.age, r.gender || null,
    r.family_unit_id || null, r.family_size || 1,
    r.is_pregnant || 0, r.has_chronic_illness || 0, r.medical_notes || null,
    r.person_type || 'refugee', r.is_active ?? 1, r.registration_date || null,
    r.mqtt_client_id || null, r.mqtt_password || null, parseTimestamp(r.created_at),
    DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('persons', count);
}

async function migrateCampCheckins() {
  const rows = campDb.prepare('SELECT * FROM camp_checkins').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO camp_checkins (id,person_id,checkin_time,camp_day,is_new_arrival,device_id)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (id) DO UPDATE SET
      person_id=EXCLUDED.person_id, checkin_time=EXCLUDED.checkin_time,
      camp_day=EXCLUDED.camp_day, is_new_arrival=EXCLUDED.is_new_arrival,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.person_id || null, parseTimestamp(r.checkin_time),
    r.camp_day || 1, r.is_new_arrival ?? 1, DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('camp_checkins', count);
}

async function migrateWristbands() {
  const rows = campDb.prepare('SELECT * FROM wristbands').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO wristbands (id,person_id,barcode,qr_identifier,status,issued_at,assigned_at,is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (id) DO UPDATE SET
      person_id=EXCLUDED.person_id, barcode=EXCLUDED.barcode,
      qr_identifier=EXCLUDED.qr_identifier, status=EXCLUDED.status,
      issued_at=EXCLUDED.issued_at, assigned_at=EXCLUDED.assigned_at,
      is_active=EXCLUDED.is_active
  `;

  const mapped = rows.map(r => [
    r.id, r.person_id || null, r.barcode, r.qr_identifier || null,
    r.status || 'AVAILABLE', parseTimestamp(r.issued_at),
    parseTimestamp(r.assigned_at), r.is_active ?? 1,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('wristbands', count);
}

async function migrateDistributions() {
  const rows = campDb.prepare('SELECT * FROM distributions').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO distributions (id,wristband_barcode,resource_type,quantity,distributed_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (id) DO UPDATE SET
      wristband_barcode=EXCLUDED.wristband_barcode, resource_type=EXCLUDED.resource_type,
      quantity=EXCLUDED.quantity, distributed_at=EXCLUDED.distributed_at,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.wristband_barcode || null, r.resource_type, r.quantity,
    parseTimestamp(r.distributed_at), DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('distributions', count);
}

async function migrateResources() {
  const rows = campDb.prepare('SELECT * FROM resources').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO resources (id,resource_name,category,unit,total_quantity,available_quantity,
      minimum_threshold,status,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id) DO UPDATE SET
      resource_name=EXCLUDED.resource_name, category=EXCLUDED.category,
      unit=EXCLUDED.unit, total_quantity=EXCLUDED.total_quantity,
      available_quantity=EXCLUDED.available_quantity, minimum_threshold=EXCLUDED.minimum_threshold,
      status=EXCLUDED.status, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at
  `;

  const mapped = rows.map(r => [
    r.id, r.resource_name, r.category || null, r.unit || 'portion',
    r.total_quantity || 0, r.available_quantity || 0, r.minimum_threshold || 0,
    r.status || 'AVAILABLE', parseTimestamp(r.created_at), parseTimestamp(r.updated_at),
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('resources', count);
}

async function migrateAuditLogs() {
  const rows = campDb.prepare('SELECT * FROM audit_logs').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO audit_logs (id,actor,action,person_id,resource_id,wristband_id,quantity,details,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO UPDATE SET
      actor=EXCLUDED.actor, action=EXCLUDED.action, person_id=EXCLUDED.person_id,
      resource_id=EXCLUDED.resource_id, wristband_id=EXCLUDED.wristband_id,
      quantity=EXCLUDED.quantity, details=EXCLUDED.details, created_at=EXCLUDED.created_at
  `;

  const mapped = rows.map(r => [
    r.id, r.actor || null, r.action, r.person_id || null, r.resource_id || null,
    r.wristband_id || null, r.quantity || null, r.details || null,
    parseTimestamp(r.created_at),
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('audit_logs', count);
}

// ══════════════════════════════════════════════════════════════════════════
// MIGRATION: disaster.db → Cloud PostgreSQL
// ══════════════════════════════════════════════════════════════════════════

async function migrateGpsReadings() {
  const rows = disasterDb.prepare('SELECT * FROM gps_readings').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO gps_readings (id,device_id,latitude,longitude,altitude,accuracy,source,recorded_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (id) DO UPDATE SET
      device_id=EXCLUDED.device_id, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
      altitude=EXCLUDED.altitude, accuracy=EXCLUDED.accuracy, source=EXCLUDED.source,
      recorded_at=EXCLUDED.recorded_at
  `;

  const mapped = rows.map(r => [
    r.id, r.device_id || DEVICE_ID, r.latitude, r.longitude,
    r.altitude || null, r.accuracy || null, r.source || 'GPS_SENSOR',
    parseTimestamp(r.recorded_at),
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('gps_readings', count);
}

async function migrateHumidityTempReadings() {
  const rows = disasterDb.prepare('SELECT * FROM HumidityTemp_readings').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO sensor_readings (id,sensor_id,sensor_type,value,unit,latitude,longitude,recorded_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO UPDATE SET
      sensor_id=EXCLUDED.sensor_id, sensor_type=EXCLUDED.sensor_type,
      value=EXCLUDED.value, unit=EXCLUDED.unit, latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude, recorded_at=EXCLUDED.recorded_at,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map((r, i) => [
    r.id, `dht11-${r.id}`, 'temperature', r.temperature, '°C',
    r.latitude || null, r.longitude || null, parseTimestamp(r.recorded_at),
    r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);

  // Also insert humidity as a separate sensor reading
  const humiditySql = `
    INSERT INTO sensor_readings (id,sensor_id,sensor_type,value,unit,latitude,longitude,recorded_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO UPDATE SET
      sensor_id=EXCLUDED.sensor_id, sensor_type=EXCLUDED.sensor_type,
      value=EXCLUDED.value, unit=EXCLUDED.unit, latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude, recorded_at=EXCLUDED.recorded_at,
      device_id=EXCLUDED.device_id
  `;

  const humidityMapped = rows.map(r => [
    r.id + 1000000, `dht11-hum-${r.id}`, 'humidity', r.humidity, '%',
    r.latitude || null, r.longitude || null, parseTimestamp(r.recorded_at),
    r.device_id || DEVICE_ID,
  ]);

  const humCount = await upsertBatch(pgPool, humiditySql, humidityMapped);
  record('sensor_readings (temp)', count);
  record('sensor_readings (humidity)', humCount);

  // Also insert as environmental_data
  const envSql = `
    INSERT INTO environmental_data (id,temperature,humidity,pressure,rainfall,wind_speed,wind_direction,recorded_at,source,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id) DO UPDATE SET
      temperature=EXCLUDED.temperature, humidity=EXCLUDED.humidity,
      recorded_at=EXCLUDED.recorded_at, source=EXCLUDED.source, device_id=EXCLUDED.device_id
  `;

  const envMapped = rows.map(r => [
    r.id, r.temperature, r.humidity, null, null, null, null,
    parseTimestamp(r.recorded_at), 'DHT11_SENSOR', r.device_id || DEVICE_ID,
  ]);

  const envCount = await upsertBatch(pgPool, envSql, envMapped);
  record('environmental_data', envCount);
}

async function migrateRainfallReadings() {
  const rows = disasterDb.prepare('SELECT * FROM rainfall_readings').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO sensor_readings (id,sensor_id,sensor_type,value,unit,latitude,longitude,recorded_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO UPDATE SET
      sensor_id=EXCLUDED.sensor_id, sensor_type=EXCLUDED.sensor_type,
      value=EXCLUDED.value, unit=EXCLUDED.unit, latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude, recorded_at=EXCLUDED.recorded_at,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, `rainfall-${r.id}`, 'rainfall', r.wetness_value || r.rain_analog || 0, 'units',
    r.latitude || null, r.longitude || null, parseTimestamp(r.recorded_at),
    r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('sensor_readings (rainfall)', count);
}

async function migrateSensorStatusReadings() {
  const rows = disasterDb.prepare('SELECT * FROM sensor_status_readings').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO sensor_readings (id,sensor_id,sensor_type,value,unit,latitude,longitude,recorded_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO UPDATE SET
      sensor_id=EXCLUDED.sensor_id, sensor_type=EXCLUDED.sensor_type,
      value=EXCLUDED.value, unit=EXCLUDED.unit, latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude, recorded_at=EXCLUDED.recorded_at,
      device_id=EXCLUDED.device_id
  `;

  // Convert sensor status to individual sensor readings
  let offsetId = 2000000;
  const mapped = [];
  for (const r of rows) {
    const ts = parseTimestamp(r.recorded_at);
    const devid = r.device_id || DEVICE_ID;
    if (r.gps_connected != null) {
      mapped.push([offsetId++, `sensor-status-gps-${r.id}`, 'gps_status', r.gps_connected, 'connected', null, null, ts, devid]);
    }
    if (r.temperature_connected != null) {
      mapped.push([offsetId++, `sensor-status-temp-${r.id}`, 'temperature_status', r.temperature_connected, 'connected', null, null, ts, devid]);
    }
    if (r.humidity_connected != null) {
      mapped.push([offsetId++, `sensor-status-hum-${r.id}`, 'humidity_status', r.humidity_connected, 'connected', null, null, ts, devid]);
    }
    if (r.rainfall_connected != null) {
      mapped.push([offsetId++, `sensor-status-rain-${r.id}`, 'rainfall_status', r.rainfall_connected, 'connected', null, null, ts, devid]);
    }
  }

  const count = await upsertBatch(pgPool, sql, mapped);
  record('sensor_readings (status)', count);
}

async function migrateWeatherData() {
  const rows = disasterDb.prepare('SELECT * FROM weather_data').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO weather_data (id,latitude,longitude,temperature,precipitation,rainfall,
      wind_speed,weather_code,forecast_time,source,created_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (id) DO UPDATE SET
      latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
      temperature=EXCLUDED.temperature, precipitation=EXCLUDED.precipitation,
      rainfall=EXCLUDED.rainfall, wind_speed=EXCLUDED.wind_speed,
      weather_code=EXCLUDED.weather_code, forecast_time=EXCLUDED.forecast_time,
      source=EXCLUDED.source, created_at=EXCLUDED.created_at,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.latitude || null, r.longitude || null, r.temperature || null,
    r.precipitation || null, r.rainfall || null, r.wind_speed || null,
    r.weather_code || null, parseTimestamp(r.forecast_time), r.source || null,
    parseTimestamp(r.created_at), r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('weather_data', count);
}

async function migrateWaterLevelReadings() {
  const rows = disasterDb.prepare('SELECT * FROM water_level_readings').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO water_level_readings (id,station_id,water_level,unit,latitude,longitude,recorded_at,source,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO UPDATE SET
      station_id=EXCLUDED.station_id, water_level=EXCLUDED.water_level,
      unit=EXCLUDED.unit, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
      recorded_at=EXCLUDED.recorded_at, source=EXCLUDED.source, device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.station_id || null, r.water_level, r.unit || 'm',
    r.latitude || null, r.longitude || null, parseTimestamp(r.recorded_at),
    r.source || null, r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('water_level_readings', count);
}

async function migrateHydrospatialData() {
  const rows = disasterDb.prepare('SELECT * FROM hydrospatial_data').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO hydrospatial_data (id,latitude,longitude,elevation,river_distance,
      nearest_station_id,river_name,source,created_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id) DO UPDATE SET
      latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
      elevation=EXCLUDED.elevation, river_distance=EXCLUDED.river_distance,
      nearest_station_id=EXCLUDED.nearest_station_id, river_name=EXCLUDED.river_name,
      source=EXCLUDED.source, created_at=EXCLUDED.created_at,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.latitude || null, r.longitude || null, r.elevation || null,
    r.river_distance || null, r.nearest_station_id || null, r.river_name || null,
    r.source || null, parseTimestamp(r.created_at), r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('hydrospatial_data', count);
}

async function migrateFloodPredictions() {
  const rows = disasterDb.prepare('SELECT * FROM flood_predictions').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO flood_predictions (id,prediction_id,latitude,longitude,rainfall,elevation,
      river_distance,flood_probability,flood_category,forecast_hours,model_version,predicted_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT (id) DO UPDATE SET
      prediction_id=EXCLUDED.prediction_id, latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude, rainfall=EXCLUDED.rainfall, elevation=EXCLUDED.elevation,
      river_distance=EXCLUDED.river_distance, flood_probability=EXCLUDED.flood_probability,
      flood_category=EXCLUDED.flood_category, forecast_hours=EXCLUDED.forecast_hours,
      model_version=EXCLUDED.model_version, predicted_at=EXCLUDED.predicted_at,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.prediction_id || null, r.latitude || null, r.longitude || null,
    r.rainfall || null, r.elevation || null, r.river_distance || null,
    r.flood_probability || null, r.flood_category || null, r.forecast_hours || null,
    r.model_version || null, parseTimestamp(r.predicted_at), r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('flood_predictions', count);
}

async function migrateDisasterAlerts() {
  const rows = disasterDb.prepare('SELECT * FROM disaster_alerts').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO disaster_alerts (id,alert_id,event_id,camp_id,camp_name,alert_type,severity,priority,
      title,message,latitude,longitude,prediction_id,flood_probability,flood_probability_percent,
      risk_category,forecast_hours,rainfall,camp_elevation,river_distance_km,water_level,
      station_id,station_name,gauge_elevation,elevation_difference,gauge_distance_km,
      gauge_latitude,gauge_longitude,river_name,camp_latitude,camp_longitude,
      source,prediction_timestamp,expires_at,schema_version,status,created_at,acknowledged_at,
      mqtt_status,cloud_sync_status,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
            $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41)
    ON CONFLICT (id) DO UPDATE SET
      alert_id=EXCLUDED.alert_id, event_id=EXCLUDED.event_id, camp_id=EXCLUDED.camp_id,
      camp_name=EXCLUDED.camp_name, alert_type=EXCLUDED.alert_type, severity=EXCLUDED.severity,
      priority=EXCLUDED.priority, title=EXCLUDED.title, message=EXCLUDED.message,
      latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, prediction_id=EXCLUDED.prediction_id,
      flood_probability=EXCLUDED.flood_probability, flood_probability_percent=EXCLUDED.flood_probability_percent,
      risk_category=EXCLUDED.risk_category, forecast_hours=EXCLUDED.forecast_hours,
      rainfall=EXCLUDED.rainfall, camp_elevation=EXCLUDED.camp_elevation,
      river_distance_km=EXCLUDED.river_distance_km, water_level=EXCLUDED.water_level,
      station_id=EXCLUDED.station_id, station_name=EXCLUDED.station_name,
      gauge_elevation=EXCLUDED.gauge_elevation, elevation_difference=EXCLUDED.elevation_difference,
      gauge_distance_km=EXCLUDED.gauge_distance_km, gauge_latitude=EXCLUDED.gauge_latitude,
      gauge_longitude=EXCLUDED.gauge_longitude, river_name=EXCLUDED.river_name,
      camp_latitude=EXCLUDED.camp_latitude, camp_longitude=EXCLUDED.camp_longitude,
      source=EXCLUDED.source, prediction_timestamp=EXCLUDED.prediction_timestamp,
      expires_at=EXCLUDED.expires_at, schema_version=EXCLUDED.schema_version,
      status=EXCLUDED.status, created_at=EXCLUDED.created_at, acknowledged_at=EXCLUDED.acknowledged_at,
      mqtt_status=EXCLUDED.mqtt_status, cloud_sync_status=EXCLUDED.cloud_sync_status,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.alert_id || null, r.event_id || null, r.camp_id || CAMP_ID,
    r.camp_name || null, r.alert_type, r.severity, r.priority || 'NORMAL',
    r.title || null, r.message || null, r.latitude ?? null, r.longitude ?? null,
    r.prediction_id || null, r.flood_probability ?? null, r.flood_probability_percent ?? null,
    r.risk_category || null, r.forecast_hours ?? null, r.rainfall ?? null,
    r.camp_elevation ?? null, r.river_distance_km ?? null, r.water_level ?? null,
    r.station_id || null, r.station_name || null, r.gauge_elevation ?? null,
    r.elevation_difference ?? null, r.gauge_distance_km ?? null,
    r.gauge_latitude ?? null, r.gauge_longitude ?? null, r.river_name || null,
    r.camp_latitude ?? null, r.camp_longitude ?? null, r.source || null,
    parseTimestamp(r.prediction_timestamp), parseTimestamp(r.expires_at),
    r.schema_version || '1.0', r.status || 'ACTIVE', parseTimestamp(r.created_at),
    parseTimestamp(r.acknowledged_at), r.mqtt_status || 'DELIVERED',
    r.cloud_sync_status || 'SYNCED', r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('disaster_alerts', count);
}

async function migrateDisasterEvents() {
  const rows = disasterDb.prepare('SELECT * FROM disaster_events').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO disaster_events (id,event_type,status,severity,location_lat,location_lng,
      started_at,ended_at,created_at,updated_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (id) DO UPDATE SET
      event_type=EXCLUDED.event_type, status=EXCLUDED.status, severity=EXCLUDED.severity,
      location_lat=EXCLUDED.location_lat, location_lng=EXCLUDED.location_lng,
      started_at=EXCLUDED.started_at, ended_at=EXCLUDED.ended_at,
      created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.event_type, r.status || 'ACTIVE', r.severity || null,
    r.location_lat || null, r.location_lng || null,
    parseTimestamp(r.started_at), parseTimestamp(r.ended_at),
    parseTimestamp(r.created_at), parseTimestamp(r.updated_at),
    r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('disaster_events', count);
}

async function migratePredictionRequests() {
  const rows = disasterDb.prepare('SELECT * FROM prediction_requests').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO prediction_requests (id,request_id,request_type,input_data,status,
      response_data,requested_at,completed_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO UPDATE SET
      request_id=EXCLUDED.request_id, request_type=EXCLUDED.request_type,
      input_data=EXCLUDED.input_data, status=EXCLUDED.status,
      response_data=EXCLUDED.response_data, requested_at=EXCLUDED.requested_at,
      completed_at=EXCLUDED.completed_at, device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.id, r.request_id || null, r.request_type || null, r.input_data || null,
    r.status || 'PENDING', r.response_data || null,
    parseTimestamp(r.requested_at), parseTimestamp(r.completed_at),
    r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('prediction_requests', count);
}

// ══════════════════════════════════════════════════════════════════════════
// MIGRATION: pages.db → Cloud PostgreSQL
// ══════════════════════════════════════════════════════════════════════════

async function migrateChildren() {
  const rows = pagesDb.prepare('SELECT * FROM pages_children').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO children (child_id,res_id,camp_id,grade,language,baseline_score,total_sessions,alert_status,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (child_id) DO UPDATE SET
      res_id=EXCLUDED.res_id, camp_id=EXCLUDED.camp_id, grade=EXCLUDED.grade,
      language=EXCLUDED.language, baseline_score=EXCLUDED.baseline_score,
      total_sessions=EXCLUDED.total_sessions, alert_status=EXCLUDED.alert_status,
      device_id=EXCLUDED.device_id
  `;

  const mapped = rows.map(r => [
    r.child_id, r.res_id || null, r.camp_id, r.grade || null,
    r.language || null, r.baseline_score || null, r.total_sessions || 0,
    r.alert_status || 'none', r.device_id || DEVICE_ID,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('children', count);
}

async function migrateSessions() {
  const rows = pagesDb.prepare('SELECT * FROM pages_sessions').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO sessions (session_id,child_id,composite_score,anomaly_flagged,alert_triggered,created_at)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (session_id) DO UPDATE SET
      child_id=EXCLUDED.child_id, composite_score=EXCLUDED.composite_score,
      anomaly_flagged=EXCLUDED.anomaly_flagged, alert_triggered=EXCLUDED.alert_triggered,
      created_at=EXCLUDED.created_at
  `;

  const mapped = rows.map(r => [
    r.session_id, r.child_id, r.composite_score || null,
    r.anomaly_flagged || 0, r.alert_triggered || 0, parseTimestamp(r.created_at),
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('sessions', count);
}

async function migrateBehavioralSignals() {
  const rows = pagesDb.prepare('SELECT * FROM pages_behavioral_signals').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO pages_behavioral_signals (signal_id,session_id,child_id,accuracy_rate,
      false_tap_rate,avg_reaction_time,reaction_variance,idle_time_ratio,
      rapid_click_count,time_to_first_ms,completion_ratio)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (signal_id) DO UPDATE SET
      session_id=EXCLUDED.session_id, child_id=EXCLUDED.child_id,
      accuracy_rate=EXCLUDED.accuracy_rate, false_tap_rate=EXCLUDED.false_tap_rate,
      avg_reaction_time=EXCLUDED.avg_reaction_time, reaction_variance=EXCLUDED.reaction_variance,
      idle_time_ratio=EXCLUDED.idle_time_ratio, rapid_click_count=EXCLUDED.rapid_click_count,
      time_to_first_ms=EXCLUDED.time_to_first_ms, completion_ratio=EXCLUDED.completion_ratio
  `;

  const mapped = rows.map(r => [
    r.signal_id, r.session_id, r.child_id, r.accuracy_rate || null,
    r.false_tap_rate || null, r.avg_reaction_time || null, r.reaction_variance || null,
    r.idle_time_ratio || null, r.rapid_click_count || 0, r.time_to_first_ms || null,
    r.completion_ratio || null,
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('pages_behavioral_signals', count);
}

async function migrateGateDecisions() {
  const rows = pagesDb.prepare('SELECT * FROM pages_gate_decisions').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO pages_gate_decisions (decision_id,session_id,child_id,attempt_number,
      composite_score,decision,decided_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (decision_id) DO UPDATE SET
      session_id=EXCLUDED.session_id, child_id=EXCLUDED.child_id,
      attempt_number=EXCLUDED.attempt_number, composite_score=EXCLUDED.composite_score,
      decision=EXCLUDED.decision, decided_at=EXCLUDED.decided_at
  `;

  const mapped = rows.map(r => [
    r.decision_id, r.session_id, r.child_id, r.attempt_number || null,
    r.composite_score, r.decision, parseTimestamp(r.decided_at),
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('pages_gate_decisions', count);
}

async function migrateAlerts() {
  const rows = pagesDb.prepare('SELECT * FROM pages_alerts').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO alerts (alert_id,child_id,res_id,camp_id,alert_type,trigger_detail,triggered_at,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (alert_id) DO UPDATE SET
      child_id=EXCLUDED.child_id, res_id=EXCLUDED.res_id, camp_id=EXCLUDED.camp_id,
      alert_type=EXCLUDED.alert_type, trigger_detail=EXCLUDED.trigger_detail,
      triggered_at=EXCLUDED.triggered_at, status=EXCLUDED.status
  `;

  const mapped = rows.map(r => [
    r.alert_id, r.child_id, r.res_id || null, r.camp_id, r.alert_type || null,
    JSON.stringify(r.trigger_detail || {}), parseTimestamp(r.triggered_at),
    r.status || 'pending',
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('alerts (education)', count);
}

async function migrateContentResponses() {
  const rows = pagesDb.prepare('SELECT * FROM pages_content_responses').all();
  if (rows.length === 0) return;

  const sql = `
    INSERT INTO pages_content_responses (response_id,session_id,child_id,task_id,
      selected_answer,is_correct,time_taken_ms,responded_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (response_id) DO UPDATE SET
      session_id=EXCLUDED.session_id, child_id=EXCLUDED.child_id,
      task_id=EXCLUDED.task_id, selected_answer=EXCLUDED.selected_answer,
      is_correct=EXCLUDED.is_correct, time_taken_ms=EXCLUDED.time_taken_ms,
      responded_at=EXCLUDED.responded_at
  `;

  const mapped = rows.map(r => [
    r.response_id, r.session_id, r.child_id, r.task_id,
    r.selected_answer, r.is_correct || 0, r.time_taken_ms,
    parseTimestamp(r.responded_at),
  ]);

  const count = await upsertBatch(pgPool, sql, mapped);
  record('pages_content_responses', count);
}

// ══════════════════════════════════════════════════════════════════════════
// DEVICE REGISTRY
// ══════════════════════════════════════════════════════════════════════════

async function registerDevice() {
  const sql = `
    INSERT INTO devices (device_id, camp_id, name, status, registered_at, updated_at)
    VALUES ($1, $2, $3, 'active', NOW(), NOW())
    ON CONFLICT (device_id) DO UPDATE SET
      camp_id = EXCLUDED.camp_id, name = COALESCE(EXCLUDED.name, devices.name),
      status = 'active', updated_at = NOW()
  `;
  await pgPool.query(sql, [DEVICE_ID, CAMP_ID, `Smart Camp Box ${DEVICE_ID}`]);
  record('devices (registry)', 1);
}

// ══════════════════════════════════════════════════════════════════════════
// FIX CLOUD CAMP_IDs
// ══════════════════════════════════════════════════════════════════════════
// If cloud records have an incorrect CAMP_ID (e.g., old hardcoded "CAMP-B"
// or the DEVICE_ID used as fallback), update them to the correct GPS-derived CAMP_ID.

async function fixCloudCampIds() {
  const tables = [
    { name: 'devices',           col: 'camp_id' },
    { name: 'children',          col: 'camp_id' },
    { name: 'disaster_alerts',   col: 'camp_id' },
    { name: 'education_alerts',  col: 'camp_id' },
  ];

  let totalFixed = 0;

  for (const { name, col } of tables) {
    try {
      // Update records where camp_id doesn't match the correct CAMP_ID
      // This covers: old hardcoded values, DEVICE_ID fallback, etc.
      const result = await pgPool.query(
        `UPDATE ${name} SET ${col} = $1, updated_at = NOW()
         WHERE ${col} != $1 AND device_id = $2`,
        [CAMP_ID, DEVICE_ID]
      );
      if (result.rowCount > 0) {
        console.log(`  ${name.padEnd(25)} ${String(result.rowCount).padStart(6)} CAMP_ID corrected → ${CAMP_ID}`);
        totalFixed += result.rowCount;
      }
    } catch {
      // Table may not exist or may not have device_id column — skip
    }
  }

  if (totalFixed > 0) {
    console.log(`  Total CAMP_ID corrections: ${totalFixed}`);
  } else {
    console.log('  All CAMP_IDs already correct.');
  }
  record('camp_id corrections', totalFixed);
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  One-Time Raspberry Pi → Cloud PostgreSQL Migration');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  DEVICE_ID: ${DEVICE_ID}`);
  console.log(`  CAMP_ID:   ${CAMP_ID}`);
  console.log('');

  try {
    openDatabases();

    // Verify cloud connection
    const testResult = await pgPool.query('SELECT 1 AS ok');
    if (testResult.rows[0]?.ok !== 1) {
      throw new Error('Cloud PostgreSQL connection test failed');
    }
    console.log('  Cloud PostgreSQL: connected');
    console.log('');

    // Register device first
    console.log('Registering device...');
    await registerDevice();
    console.log('');

    // Fix any cloud records with incorrect CAMP_ID
    console.log('Fixing cloud CAMP_IDs...');
    await fixCloudCampIds();
    console.log('');

    // ── camp.db migration ──
    console.log('Migrating camp.db → Cloud PostgreSQL...');
    await migratePersons();
    await migrateCampCheckins();
    await migrateWristbands();
    await migrateDistributions();
    await migrateResources();
    await migrateAuditLogs();
    console.log('');

    // ── disaster.db migration ──
    console.log('Migrating disaster.db → Cloud PostgreSQL...');
    await migrateGpsReadings();
    await migrateHumidityTempReadings();
    await migrateRainfallReadings();
    await migrateSensorStatusReadings();
    await migrateWeatherData();
    await migrateWaterLevelReadings();
    await migrateHydrospatialData();
    await migrateFloodPredictions();
    await migrateDisasterAlerts();
    await migrateDisasterEvents();
    await migratePredictionRequests();
    console.log('');

    // ── pages.db migration ──
    console.log('Migrating pages.db → Cloud PostgreSQL...');
    await migrateChildren();
    await migrateSessions();
    await migrateBehavioralSignals();
    await migrateGateDecisions();
    await migrateAlerts();
    await migrateContentResponses();
    console.log('');

    // ── Summary ──
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Migration Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    let totalRecords = 0;
    for (const [table, count] of Object.entries(results)) {
      if (count > 0) {
        console.log(`  ${table.padEnd(35)} ${String(count).padStart(6)}`);
        totalRecords += count;
      }
    }
    console.log('');
    console.log(`  TOTAL: ${totalRecords} records migrated`);
    console.log('');
    console.log('  Skipped tables (sync infrastructure):');
    console.log('    mqtt_buffer, sync_pending, sync_log, disaster_sync_queue,');
    console.log('    disaster_sync_log, pages_sync_queue, pages_sync_log');
    console.log('');
    console.log('  Skipped tables (empty):');
    console.log('    resource_usage, content_tasks');
    console.log('');
    console.log('  Skipped tables (non-migratable):');
    console.log('    pages_admins, wristband_assignments');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Migration completed successfully.');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

  } catch (err) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('  MIGRATION FAILED');
    console.error('═══════════════════════════════════════════════════════════');
    console.error(`  Error: ${err.message}`);
    console.error('');
    if (err.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  } finally {
    await closeDatabases();
  }
}

main();
