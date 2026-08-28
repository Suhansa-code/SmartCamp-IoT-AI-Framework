import 'dotenv/config';
import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEVICE_ID = process.env.DEVICE_ID || 'SCB-UNIT-01';
const CAMP_ID = DEVICE_ID;

const CAMP_DB_PATH = path.join(__dirname, '..', 'db', 'camp.db');
const DISASTER_DB_PATH = path.join(__dirname, '..', 'db', 'disaster.db');
const PAGES_DB_PATH = path.join(__dirname, '..', 'db', 'pages.db');

const PG_CONFIG = {
  connectionString: 'postgresql://neondb_owner:npg_BwI0CNUj3mnu@ep-withered-snow-ayn23ggm.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require'
};

const campDb = new Database(CAMP_DB_PATH, { readonly: true });
const disasterDb = new Database(DISASTER_DB_PATH, { readonly: true });
const pagesDb = new Database(PAGES_DB_PATH, { readonly: true });

let pool = new pg.Pool({ ...PG_CONFIG, max: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 });

function parseTimestamp(v) { if (!v) return null; try { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); } catch { return null; } }

async function ensureSchema(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS public');
  await client.query('SET search_path TO public');
}

async function runMigration(name, sql, rows) {
  if (rows.length === 0) { console.log(`${name.padEnd(30)} (empty)`); return; }
  const client = await pool.connect();
  let count = 0;
  try {
    await ensureSchema(client);
    await client.query('BEGIN');
    for (const row of rows) {
      try {
        await client.query(sql, row);
        count++;
      } catch (err) {
        if (!err.message.includes('duplicate key')) {
          console.error(`  ${name} row error: ${err.message.substring(0, 100)}`);
        }
      }
    }
    await client.query('COMMIT');
    console.log(`${name.padEnd(30)} ${String(count).padStart(6)} migrated`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ${name} FAILED: ${err.message.substring(0, 120)}`);
  } finally {
    client.release();
  }
}

// ── DISASTER.DB TABLES ──────────────────────────────────────────────────

async function migrateHumidityTempReadings() {
  const rows = disasterDb.prepare('SELECT * FROM HumidityTemp_readings').all();
  const sql = `INSERT INTO sensor_readings (id,sensor_id,sensor_type,value,unit,latitude,longitude,recorded_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET
    sensor_id=EXCLUDED.sensor_id, sensor_type=EXCLUDED.sensor_type, value=EXCLUDED.value,
    unit=EXCLUDED.unit, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
    recorded_at=EXCLUDED.recorded_at, device_id=EXCLUDED.device_id`;
  const mapped = rows.map(r => [r.id, `dht11-${r.id}`, 'temperature', r.temperature, '°C',
    r.latitude || null, r.longitude || null, parseTimestamp(r.recorded_at), r.device_id || DEVICE_ID]);
  await runMigration('sensor_readings (temp)', sql, mapped);

  const humSql = sql;
  const humMapped = rows.map(r => [r.id + 1000000, `dht11-hum-${r.id}`, 'humidity', r.humidity, '%',
    r.latitude || null, r.longitude || null, parseTimestamp(r.recorded_at), r.device_id || DEVICE_ID]);
  await runMigration('sensor_readings (humidity)', humSql, humMapped);

  const envSql = `INSERT INTO environmental_data (id,temperature,humidity,pressure,rainfall,wind_speed,wind_direction,recorded_at,source,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET
    temperature=EXCLUDED.temperature, humidity=EXCLUDED.humidity, recorded_at=EXCLUDED.recorded_at,
    source=EXCLUDED.source, device_id=EXCLUDED.device_id`;
  const envMapped = rows.map(r => [r.id, r.temperature, r.humidity, null, null, null, null,
    parseTimestamp(r.recorded_at), 'DHT11_SENSOR', r.device_id || DEVICE_ID]);
  await runMigration('environmental_data', envSql, envMapped);
}

async function migrateRainfallReadings() {
  const rows = disasterDb.prepare('SELECT * FROM rainfall_readings').all();
  const sql = `INSERT INTO sensor_readings (id,sensor_id,sensor_type,value,unit,latitude,longitude,recorded_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET
    sensor_id=EXCLUDED.sensor_id, sensor_type=EXCLUDED.sensor_type, value=EXCLUDED.value,
    unit=EXCLUDED.unit, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
    recorded_at=EXCLUDED.recorded_at, device_id=EXCLUDED.device_id`;
  const mapped = rows.map(r => [r.id, `rainfall-${r.id}`, 'rainfall', r.wetness_value || r.rain_analog || 0, 'units',
    r.latitude || null, r.longitude || null, parseTimestamp(r.recorded_at), r.device_id || DEVICE_ID]);
  await runMigration('sensor_readings (rainfall)', sql, mapped);
}

async function migrateSensorStatusReadings() {
  const rows = disasterDb.prepare('SELECT * FROM sensor_status_readings').all();
  const sql = `INSERT INTO sensor_readings (id,sensor_id,sensor_type,value,unit,latitude,longitude,recorded_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET
    sensor_id=EXCLUDED.sensor_id, sensor_type=EXCLUDED.sensor_type, value=EXCLUDED.value,
    unit=EXCLUDED.unit, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
    recorded_at=EXCLUDED.recorded_at, device_id=EXCLUDED.device_id`;
  let offsetId = 2000000;
  const mapped = [];
  for (const r of rows) {
    const ts = parseTimestamp(r.recorded_at);
    const devid = r.device_id || DEVICE_ID;
    if (r.gps_connected != null) mapped.push([offsetId++, `sensor-status-gps-${r.id}`, 'gps_status', r.gps_connected, 'connected', null, null, ts, devid]);
    if (r.temperature_connected != null) mapped.push([offsetId++, `sensor-status-temp-${r.id}`, 'temperature_status', r.temperature_connected, 'connected', null, null, ts, devid]);
    if (r.humidity_connected != null) mapped.push([offsetId++, `sensor-status-hum-${r.id}`, 'humidity_status', r.humidity_connected, 'connected', null, null, ts, devid]);
    if (r.rainfall_connected != null) mapped.push([offsetId++, `sensor-status-rain-${r.id}`, 'rainfall_status', r.rainfall_connected, 'connected', null, null, ts, devid]);
  }
  await runMigration('sensor_readings (status)', sql, mapped);
}

async function migrateWeatherData() {
  const rows = disasterDb.prepare('SELECT * FROM weather_data').all();
  const sql = `INSERT INTO weather_data (id,latitude,longitude,temperature,precipitation,rainfall,
    wind_speed,weather_code,forecast_time,source,created_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET
    latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, temperature=EXCLUDED.temperature,
    precipitation=EXCLUDED.precipitation, rainfall=EXCLUDED.rainfall, wind_speed=EXCLUDED.wind_speed,
    weather_code=EXCLUDED.weather_code, forecast_time=EXCLUDED.forecast_time, source=EXCLUDED.source,
    created_at=EXCLUDED.created_at, device_id=EXCLUDED.device_id`;
  const mapped = rows.map(r => [r.id, r.latitude || null, r.longitude || null, r.temperature || null,
    r.precipitation || null, r.rainfall || null, r.wind_speed || null, r.weather_code || null,
    parseTimestamp(r.forecast_time), r.source || null, parseTimestamp(r.created_at), r.device_id || DEVICE_ID]);
  await runMigration('weather_data', sql, mapped);
}

async function migrateWaterLevelReadings() {
  const rows = disasterDb.prepare('SELECT * FROM water_level_readings').all();
  const sql = `INSERT INTO water_level_readings (id,station_id,water_level,unit,latitude,longitude,recorded_at,source,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET
    station_id=EXCLUDED.station_id, water_level=EXCLUDED.water_level, unit=EXCLUDED.unit,
    latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, recorded_at=EXCLUDED.recorded_at,
    source=EXCLUDED.source, device_id=EXCLUDED.device_id`;
  const mapped = rows.map(r => [r.id, r.station_id || null, r.water_level, r.unit || 'm',
    r.latitude || null, r.longitude || null, parseTimestamp(r.recorded_at), r.source || null, r.device_id || DEVICE_ID]);
  await runMigration('water_level_readings', sql, mapped);
}

async function migrateHydrospatialData() {
  const rows = disasterDb.prepare('SELECT * FROM hydrospatial_data').all();
  const sql = `INSERT INTO hydrospatial_data (id,latitude,longitude,elevation,river_distance,
    nearest_station_id,river_name,source,created_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET
    latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, elevation=EXCLUDED.elevation,
    river_distance=EXCLUDED.river_distance, nearest_station_id=EXCLUDED.nearest_station_id,
    river_name=EXCLUDED.river_name, source=EXCLUDED.source, created_at=EXCLUDED.created_at,
    device_id=EXCLUDED.device_id`;
  const mapped = rows.map(r => [r.id, r.latitude || null, r.longitude || null, r.elevation || null,
    r.river_distance || null, r.nearest_station_id || null, r.river_name || null,
    r.source || null, parseTimestamp(r.created_at), r.device_id || DEVICE_ID]);
  await runMigration('hydrospatial_data', sql, mapped);
}

async function migrateFloodPredictions() {
  const rows = disasterDb.prepare('SELECT * FROM flood_predictions').all();
  const sql = `INSERT INTO flood_predictions (id,prediction_id,latitude,longitude,rainfall,elevation,
    river_distance,flood_probability,flood_category,forecast_hours,model_version,predicted_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO UPDATE SET
    prediction_id=EXCLUDED.prediction_id, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
    rainfall=EXCLUDED.rainfall, elevation=EXCLUDED.elevation, river_distance=EXCLUDED.river_distance,
    flood_probability=EXCLUDED.flood_probability, flood_category=EXCLUDED.flood_category,
    forecast_hours=EXCLUDED.forecast_hours, model_version=EXCLUDED.model_version,
    predicted_at=EXCLUDED.predicted_at, device_id=EXCLUDED.device_id`;
  const mapped = rows.map(r => [r.id, r.prediction_id || null, r.latitude || null, r.longitude || null,
    r.rainfall || null, r.elevation || null, r.river_distance || null, r.flood_probability || null,
    r.flood_category || null, r.forecast_hours || null, r.model_version || null,
    parseTimestamp(r.predicted_at), r.device_id || DEVICE_ID]);
  await runMigration('flood_predictions', sql, mapped);
}

async function migrateDisasterAlerts() {
  const rows = disasterDb.prepare('SELECT * FROM disaster_alerts').all();
  const sql = `INSERT INTO disaster_alerts (id,alert_id,event_id,camp_id,camp_name,alert_type,severity,priority,
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
    device_id=EXCLUDED.device_id`;
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
  await runMigration('disaster_alerts', sql, mapped);
}

async function migrateDisasterEvents() {
  const rows = disasterDb.prepare('SELECT * FROM disaster_events').all();
  const sql = `INSERT INTO disaster_events (id,event_type,status,severity,location_lat,location_lng,
    started_at,ended_at,created_at,updated_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET
    event_type=EXCLUDED.event_type, status=EXCLUDED.status, severity=EXCLUDED.severity,
    location_lat=EXCLUDED.location_lat, location_lng=EXCLUDED.location_lng,
    started_at=EXCLUDED.started_at, ended_at=EXCLUDED.ended_at,
    created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at, device_id=EXCLUDED.device_id`;
  const mapped = rows.map(r => [r.id, r.event_type, r.status || 'ACTIVE', r.severity || null,
    r.location_lat || null, r.location_lng || null, parseTimestamp(r.started_at),
    parseTimestamp(r.ended_at), parseTimestamp(r.created_at), parseTimestamp(r.updated_at),
    r.device_id || DEVICE_ID]);
  await runMigration('disaster_events', sql, mapped);
}

async function migratePredictionRequests() {
  const rows = disasterDb.prepare('SELECT * FROM prediction_requests').all();
  const sql = `INSERT INTO prediction_requests (id,request_id,request_type,input_data,status,
    response_data,requested_at,completed_at,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET
    request_id=EXCLUDED.request_id, request_type=EXCLUDED.request_type,
    input_data=EXCLUDED.input_data, status=EXCLUDED.status, response_data=EXCLUDED.response_data,
    requested_at=EXCLUDED.requested_at, completed_at=EXCLUDED.completed_at, device_id=EXCLUDED.device_id`;
  const mapped = rows.map(r => [r.id, r.request_id || null, r.request_type || null, r.input_data || null,
    r.status || 'PENDING', r.response_data || null, parseTimestamp(r.requested_at),
    parseTimestamp(r.completed_at), r.device_id || DEVICE_ID]);
  await runMigration('prediction_requests', sql, mapped);
}

// ── PAGES.DB TABLES ────────────────────────────────────────────────────

async function migrateChildren() {
  const rows = pagesDb.prepare('SELECT * FROM pages_children').all();
  const sql = `INSERT INTO children (child_id,res_id,camp_id,grade,language,baseline_score,total_sessions,alert_status,device_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (child_id) DO UPDATE SET
    res_id=EXCLUDED.res_id, camp_id=EXCLUDED.camp_id, grade=EXCLUDED.grade,
    language=EXCLUDED.language, baseline_score=EXCLUDED.baseline_score,
    total_sessions=EXCLUDED.total_sessions, alert_status=EXCLUDED.alert_status, device_id=EXCLUDED.device_id`;
  const mapped = rows.map(r => [r.child_id, r.res_id || null, r.camp_id, r.grade || null,
    r.language || null, r.baseline_score || null, r.total_sessions || 0,
    r.alert_status || 'none', r.device_id || DEVICE_ID]);
  await runMigration('children', sql, mapped);
}

async function migrateSessions() {
  const rows = pagesDb.prepare('SELECT * FROM pages_sessions').all();
  const sql = `INSERT INTO sessions (session_id,child_id,composite_score,anomaly_flagged,alert_triggered,created_at)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (session_id) DO UPDATE SET
    child_id=EXCLUDED.child_id, composite_score=EXCLUDED.composite_score,
    anomaly_flagged=EXCLUDED.anomaly_flagged, alert_triggered=EXCLUDED.alert_triggered,
    created_at=EXCLUDED.created_at`;
  const mapped = rows.map(r => [r.session_id, r.child_id, r.composite_score || null,
    r.anomaly_flagged || 0, r.alert_triggered || 0, parseTimestamp(r.created_at)]);
  await runMigration('sessions', sql, mapped);
}

async function migrateBehavioralSignals() {
  const rows = pagesDb.prepare('SELECT * FROM pages_behavioral_signals').all();
  const sql = `INSERT INTO pages_behavioral_signals (signal_id,session_id,child_id,accuracy_rate,
    false_tap_rate,avg_reaction_time,reaction_variance,idle_time_ratio,
    rapid_click_count,time_to_first_ms,completion_ratio)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (signal_id) DO UPDATE SET
    session_id=EXCLUDED.session_id, child_id=EXCLUDED.child_id, accuracy_rate=EXCLUDED.accuracy_rate,
    false_tap_rate=EXCLUDED.false_tap_rate, avg_reaction_time=EXCLUDED.avg_reaction_time,
    reaction_variance=EXCLUDED.reaction_variance, idle_time_ratio=EXCLUDED.idle_time_ratio,
    rapid_click_count=EXCLUDED.rapid_click_count, time_to_first_ms=EXCLUDED.time_to_first_ms,
    completion_ratio=EXCLUDED.completion_ratio`;
  const mapped = rows.map(r => [r.signal_id, r.session_id, r.child_id, r.accuracy_rate || null,
    r.false_tap_rate || null, r.avg_reaction_time || null, r.reaction_variance || null,
    r.idle_time_ratio || null, r.rapid_click_count || 0, r.time_to_first_ms || null,
    r.completion_ratio || null]);
  await runMigration('pages_behavioral_signals', sql, mapped);
}

async function migrateGateDecisions() {
  const rows = pagesDb.prepare('SELECT * FROM pages_gate_decisions').all();
  const sql = `INSERT INTO pages_gate_decisions (decision_id,session_id,child_id,attempt_number,
    composite_score,decision,decided_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (decision_id) DO UPDATE SET
    session_id=EXCLUDED.session_id, child_id=EXCLUDED.child_id, attempt_number=EXCLUDED.attempt_number,
    composite_score=EXCLUDED.composite_score, decision=EXCLUDED.decision, decided_at=EXCLUDED.decided_at`;
  const mapped = rows.map(r => [r.decision_id, r.session_id, r.child_id, r.attempt_number || null,
    r.composite_score, r.decision, parseTimestamp(r.decided_at)]);
  await runMigration('pages_gate_decisions', sql, mapped);
}

async function migrateAlerts() {
  const rows = pagesDb.prepare('SELECT * FROM pages_alerts').all();
  const sql = `INSERT INTO alerts (alert_id,child_id,res_id,camp_id,alert_type,trigger_detail,triggered_at,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (alert_id) DO UPDATE SET
    child_id=EXCLUDED.child_id, res_id=EXCLUDED.res_id, camp_id=EXCLUDED.camp_id,
    alert_type=EXCLUDED.alert_type, trigger_detail=EXCLUDED.trigger_detail,
    triggered_at=EXCLUDED.triggered_at, status=EXCLUDED.status`;
  const mapped = rows.map(r => [r.alert_id, r.child_id, r.res_id || null, r.camp_id, r.alert_type || null,
    JSON.stringify(r.trigger_detail || {}), parseTimestamp(r.triggered_at), r.status || 'pending']);
  await runMigration('alerts (education)', sql, mapped);
}

async function migrateContentResponses() {
  const rows = pagesDb.prepare('SELECT * FROM pages_content_responses').all();
  const sql = `INSERT INTO pages_content_responses (response_id,session_id,child_id,task_id,
    selected_answer,is_correct,time_taken_ms,responded_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (response_id) DO UPDATE SET
    session_id=EXCLUDED.session_id, child_id=EXCLUDED.child_id, task_id=EXCLUDED.task_id,
    selected_answer=EXCLUDED.selected_answer, is_correct=EXCLUDED.is_correct,
    time_taken_ms=EXCLUDED.time_taken_ms, responded_at=EXCLUDED.responded_at`;
  const mapped = rows.map(r => [r.response_id, r.session_id, r.child_id, r.task_id,
    r.selected_answer, r.is_correct || 0, r.time_taken_ms, parseTimestamp(r.responded_at)]);
  await runMigration('pages_content_responses', sql, mapped);
}

async function migrateDeviceRegistry() {
  const sql = `INSERT INTO devices (device_id, camp_id, name, status, registered_at, updated_at)
    VALUES ($1, $2, $3, 'active', NOW(), NOW())
    ON CONFLICT (device_id) DO UPDATE SET
    camp_id = EXCLUDED.camp_id, name = COALESCE(EXCLUDED.name, devices.name),
    status = 'active', updated_at = NOW()`;
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    await client.query(sql, [DEVICE_ID, CAMP_ID, `Smart Camp Box ${DEVICE_ID}`]);
    console.log(`${'devices (registry)'.padEnd(30)} 1 migrated`);
  } finally {
    client.release();
  }
}

// ── MAIN ───────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Migration: Remaining Tables');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  DEVICE_ID: ${DEVICE_ID}  CAMP_ID: ${CAMP_ID}\n`);

  try {
    await migrateDeviceRegistry();
    console.log('\nDisaster.db tables:');
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
    // Refresh Neon connection before pages.db (prevents idle timeout crash)
    await pool.end();
    pool = new pg.Pool({ ...PG_CONFIG, max: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 });
    await pool.query('SELECT 1');

    console.log('\nPages.db tables:');
    await migrateChildren();
    await migrateSessions();
    await migrateBehavioralSignals();
    await migrateGateDecisions();
    await migrateAlerts();
    await migrateContentResponses();
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Done');
    console.log('═══════════════════════════════════════════════════════════');
  } catch (err) {
    console.error(`\nFAILED: ${err.message}`);
    process.exitCode = 1;
  } finally {
    campDb.close();
    disasterDb.close();
    pagesDb.close();
    await pool.end();
  }
}

main();
