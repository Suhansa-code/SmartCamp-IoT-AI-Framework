/**
 * sync.postgres.repository.js — Idempotent PostgreSQL upserts for all sync entities.
 *
 * Each function uses ON CONFLICT ... DO UPDATE to safely handle duplicate
 * MQTT deliveries. The sync_log table tracks received sync_ids.
 */
import { getPool } from '../../config/database.js';

export async function isSyncProcessed(syncId) {
  const pool = getPool();
  const result = await pool.query('SELECT 1 FROM sync_log WHERE sync_id = $1', [syncId]);
  return result.rowCount > 0;
}

export async function logSync(syncId, entity, localId, campId, operation) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO sync_log (sync_id, entity, local_id, camp_id, operation, status, received_at)
     VALUES ($1, $2, $3, $4, $5, 'processed', NOW())
     ON CONFLICT (sync_id) DO NOTHING`,
    [syncId, entity, String(localId), campId || null, operation]
  );
}

// ── Resource domain ──────────────────────────────────────────────────────

export async function upsertPerson(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO persons (id,fingerprint_id,full_name,age,gender,family_unit_id,family_size,
       is_pregnant,has_chronic_illness,medical_notes,person_type,is_active,registration_date,
       mqtt_client_id,mqtt_password,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (id) DO UPDATE SET fingerprint_id=EXCLUDED.fingerprint_id,
       full_name=EXCLUDED.full_name,age=EXCLUDED.age,gender=EXCLUDED.gender,
       family_unit_id=EXCLUDED.family_unit_id,family_size=EXCLUDED.family_size,
       is_pregnant=EXCLUDED.is_pregnant,has_chronic_illness=EXCLUDED.has_chronic_illness,
       medical_notes=EXCLUDED.medical_notes,person_type=EXCLUDED.person_type,
       is_active=EXCLUDED.is_active,registration_date=EXCLUDED.registration_date,
       mqtt_client_id=EXCLUDED.mqtt_client_id,mqtt_password=EXCLUDED.mqtt_password,
       created_at=EXCLUDED.created_at`,
    [r.id,r.fingerprint_id,r.full_name,r.age,r.gender||null,r.family_unit_id||null,
     r.family_size||1,r.is_pregnant||0,r.has_chronic_illness||0,r.medical_notes||null,
     r.person_type||'refugee',r.is_active??1,r.registration_date||null,
     r.mqtt_client_id||null,r.mqtt_password||null,r.created_at||null]
  );
}

export async function upsertCheckin(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO camp_checkins (id,person_id,checkin_time,camp_day,is_new_arrival)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET person_id=EXCLUDED.person_id,
       checkin_time=EXCLUDED.checkin_time,camp_day=EXCLUDED.camp_day,
       is_new_arrival=EXCLUDED.is_new_arrival`,
    [r.id,r.person_id||null,r.checkin_time||null,r.camp_day||1,r.is_new_arrival??1]
  );
}

export async function upsertWristband(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO wristbands (id,person_id,barcode,qr_identifier,status,issued_at,assigned_at,is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET person_id=EXCLUDED.person_id,barcode=EXCLUDED.barcode,
       qr_identifier=EXCLUDED.qr_identifier,status=EXCLUDED.status,issued_at=EXCLUDED.issued_at,
       assigned_at=EXCLUDED.assigned_at,is_active=EXCLUDED.is_active`,
    [r.id,r.person_id||null,r.barcode,r.qr_identifier||null,r.status||'AVAILABLE',
     r.issued_at||null,r.assigned_at||null,r.is_active??1]
  );
}

export async function upsertDistribution(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO distributions (id,wristband_barcode,resource_type,quantity,distributed_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET wristband_barcode=EXCLUDED.wristband_barcode,
       resource_type=EXCLUDED.resource_type,quantity=EXCLUDED.quantity,
       distributed_at=EXCLUDED.distributed_at`,
    [r.id,r.wristband_barcode||null,r.resource_type,r.quantity,r.distributed_at||null]
  );
}

export async function upsertResource(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO resources (id,resource_name,category,unit,total_quantity,available_quantity,
       minimum_threshold,status,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET resource_name=EXCLUDED.resource_name,
       category=EXCLUDED.category,unit=EXCLUDED.unit,total_quantity=EXCLUDED.total_quantity,
       available_quantity=EXCLUDED.available_quantity,minimum_threshold=EXCLUDED.minimum_threshold,
       status=EXCLUDED.status,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at`,
    [r.id,r.resource_name,r.category||null,r.unit||'portion',r.total_quantity||0,
     r.available_quantity||0,r.minimum_threshold||0,r.status||'AVAILABLE',
     r.created_at||null,r.updated_at||null]
  );
}

export async function upsertResourceUsage(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO resource_usage (id,person_id,resource_id,meal,quantity,date,time,recorded_by,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET person_id=EXCLUDED.person_id,resource_id=EXCLUDED.resource_id,
       meal=EXCLUDED.meal,quantity=EXCLUDED.quantity,date=EXCLUDED.date,time=EXCLUDED.time,
       recorded_by=EXCLUDED.recorded_by,created_at=EXCLUDED.created_at`,
    [r.id,r.person_id,r.resource_id,r.meal||null,r.quantity,r.date,r.time,
     r.recorded_by||null,r.created_at||null]
  );
}

export async function upsertAuditLog(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO audit_logs (id,actor,action,person_id,resource_id,wristband_id,quantity,details,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET actor=EXCLUDED.actor,action=EXCLUDED.action,
       person_id=EXCLUDED.person_id,resource_id=EXCLUDED.resource_id,
       wristband_id=EXCLUDED.wristband_id,quantity=EXCLUDED.quantity,
       details=EXCLUDED.details,created_at=EXCLUDED.created_at`,
    [r.id,r.actor||null,r.action,r.person_id||null,r.resource_id||null,
     r.wristband_id||null,r.quantity||null,r.details||null,r.created_at||null]
  );
}

// ── Education domain ─────────────────────────────────────────────────────

export async function upsertChild(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO children (child_id,res_id,camp_id,grade,language,baseline_score,total_sessions,alert_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (child_id) DO UPDATE SET res_id=EXCLUDED.res_id,camp_id=EXCLUDED.camp_id,
       grade=EXCLUDED.grade,language=EXCLUDED.language,baseline_score=EXCLUDED.baseline_score,
       total_sessions=EXCLUDED.total_sessions,alert_status=EXCLUDED.alert_status`,
    [r.child_id,r.res_id||null,r.camp_id,r.grade||null,r.language||null,
     r.baseline_score||null,r.total_sessions||0,r.alert_status||'none']
  );
}

export async function upsertSession(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO sessions (session_id,child_id,composite_score,anomaly_flagged,alert_triggered,created_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (session_id) DO UPDATE SET child_id=EXCLUDED.child_id,
       composite_score=EXCLUDED.composite_score,anomaly_flagged=EXCLUDED.anomaly_flagged,
       alert_triggered=EXCLUDED.alert_triggered,created_at=EXCLUDED.created_at`,
    [r.session_id,r.child_id,r.composite_score||null,r.anomaly_flagged||0,
     r.alert_triggered||0,r.created_at||null]
  );
}

export async function upsertBehavioralSignal(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO pages_behavioral_signals (signal_id,session_id,child_id,accuracy_rate,
       false_tap_rate,avg_reaction_time,reaction_variance,idle_time_ratio,
       rapid_click_count,time_to_first_ms,completion_ratio)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (signal_id) DO UPDATE SET session_id=EXCLUDED.session_id,
       child_id=EXCLUDED.child_id,accuracy_rate=EXCLUDED.accuracy_rate,
       false_tap_rate=EXCLUDED.false_tap_rate,avg_reaction_time=EXCLUDED.avg_reaction_time,
       reaction_variance=EXCLUDED.reaction_variance,idle_time_ratio=EXCLUDED.idle_time_ratio,
       rapid_click_count=EXCLUDED.rapid_click_count,time_to_first_ms=EXCLUDED.time_to_first_ms,
       completion_ratio=EXCLUDED.completion_ratio`,
    [r.signal_id,r.session_id,r.child_id,r.accuracy_rate||null,r.false_tap_rate||null,
     r.avg_reaction_time||null,r.reaction_variance||null,r.idle_time_ratio||null,
     r.rapid_click_count||0,r.time_to_first_ms||null,r.completion_ratio||null]
  );
}

export async function upsertGateDecision(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO pages_gate_decisions (decision_id,session_id,child_id,attempt_number,
       composite_score,decision,decided_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (decision_id) DO UPDATE SET session_id=EXCLUDED.session_id,
       child_id=EXCLUDED.child_id,attempt_number=EXCLUDED.attempt_number,
       composite_score=EXCLUDED.composite_score,decision=EXCLUDED.decision,
       decided_at=EXCLUDED.decided_at`,
    [r.decision_id,r.session_id,r.child_id,r.attempt_number||null,
     r.composite_score,r.decision,r.decided_at||null]
  );
}

export async function upsertAlert(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO alerts (alert_id,child_id,res_id,camp_id,alert_type,trigger_detail,triggered_at,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (alert_id) DO UPDATE SET child_id=EXCLUDED.child_id,res_id=EXCLUDED.res_id,
       camp_id=EXCLUDED.camp_id,alert_type=EXCLUDED.alert_type,
       trigger_detail=EXCLUDED.trigger_detail,triggered_at=EXCLUDED.triggered_at,
       status=EXCLUDED.status`,
    [r.alert_id,r.child_id,r.res_id||null,r.camp_id,r.alert_type||null,
     JSON.stringify(r.trigger_detail||{}),r.triggered_at||null,r.status||'pending']
  );
}

export async function upsertContentResponse(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO pages_content_responses (response_id,session_id,child_id,task_id,
       selected_answer,is_correct,time_taken_ms,responded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (response_id) DO UPDATE SET session_id=EXCLUDED.session_id,
       child_id=EXCLUDED.child_id,task_id=EXCLUDED.task_id,
       selected_answer=EXCLUDED.selected_answer,is_correct=EXCLUDED.is_correct,
       time_taken_ms=EXCLUDED.time_taken_ms,responded_at=EXCLUDED.responded_at`,
    [r.response_id,r.session_id,r.child_id,r.task_id,r.selected_answer,
     r.is_correct||0,r.time_taken_ms,r.responded_at||null]
  );
}

// ── Disaster domain ─────────────────────────────────────────────────────

export async function upsertDisasterEvent(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO disaster_events (id,event_type,status,severity,location_lat,location_lng,
       started_at,ended_at,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET event_type=EXCLUDED.event_type,status=EXCLUDED.status,
       severity=EXCLUDED.severity,location_lat=EXCLUDED.location_lat,location_lng=EXCLUDED.location_lng,
       started_at=EXCLUDED.started_at,ended_at=EXCLUDED.ended_at,
       created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at`,
    [r.id,r.event_type,r.status||'ACTIVE',r.severity||null,
     r.location_lat||null,r.location_lng||null,
     r.started_at||null,r.ended_at||null,r.created_at||null,r.updated_at||null]
  );
}

export async function upsertSensorReading(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO sensor_readings (id,sensor_id,sensor_type,value,unit,latitude,longitude,recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET sensor_id=EXCLUDED.sensor_id,sensor_type=EXCLUDED.sensor_type,
       value=EXCLUDED.value,unit=EXCLUDED.unit,latitude=EXCLUDED.latitude,
       longitude=EXCLUDED.longitude,recorded_at=EXCLUDED.recorded_at`,
    [r.id,r.sensor_id,r.sensor_type,r.value,r.unit||null,
     r.latitude||null,r.longitude||null,r.recorded_at||null]
  );
}

export async function upsertEnvironmentalData(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO environmental_data (id,temperature,humidity,pressure,rainfall,
       wind_speed,wind_direction,recorded_at,source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET temperature=EXCLUDED.temperature,humidity=EXCLUDED.humidity,
       pressure=EXCLUDED.pressure,rainfall=EXCLUDED.rainfall,wind_speed=EXCLUDED.wind_speed,
       wind_direction=EXCLUDED.wind_direction,recorded_at=EXCLUDED.recorded_at,source=EXCLUDED.source`,
    [r.id,r.temperature||null,r.humidity||null,r.pressure||null,r.rainfall||null,
     r.wind_speed||null,r.wind_direction||null,r.recorded_at||null,r.source||null]
  );
}

export async function upsertWaterLevelReading(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO water_level_readings (id,station_id,water_level,unit,latitude,longitude,recorded_at,source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET station_id=EXCLUDED.station_id,water_level=EXCLUDED.water_level,
       unit=EXCLUDED.unit,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
       recorded_at=EXCLUDED.recorded_at,source=EXCLUDED.source`,
    [r.id,r.station_id||null,r.water_level,r.unit||null,
     r.latitude||null,r.longitude||null,r.recorded_at||null,r.source||null]
  );
}

export async function upsertGpsReading(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO gps_readings (id,device_id,latitude,longitude,altitude,accuracy,recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET device_id=EXCLUDED.device_id,latitude=EXCLUDED.latitude,
       longitude=EXCLUDED.longitude,altitude=EXCLUDED.altitude,accuracy=EXCLUDED.accuracy,
       recorded_at=EXCLUDED.recorded_at`,
    [r.id,r.device_id||null,r.latitude,r.longitude,
     r.altitude||null,r.accuracy||null,r.recorded_at||null]
  );
}

export async function upsertWeatherData(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO weather_data (id,latitude,longitude,temperature,precipitation,rainfall,
       wind_speed,weather_code,forecast_time,source,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
       temperature=EXCLUDED.temperature,precipitation=EXCLUDED.precipitation,
       rainfall=EXCLUDED.rainfall,wind_speed=EXCLUDED.wind_speed,weather_code=EXCLUDED.weather_code,
       forecast_time=EXCLUDED.forecast_time,source=EXCLUDED.source,created_at=EXCLUDED.created_at`,
    [r.id,r.latitude||null,r.longitude||null,r.temperature||null,r.precipitation||null,
     r.rainfall||null,r.wind_speed||null,r.weather_code||null,
     r.forecast_time||null,r.source||null,r.created_at||null]
  );
}

export async function upsertHydrospatialData(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO hydrospatial_data (id,latitude,longitude,elevation,river_distance,
       nearest_station_id,river_name,source,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
       elevation=EXCLUDED.elevation,river_distance=EXCLUDED.river_distance,
       nearest_station_id=EXCLUDED.nearest_station_id,river_name=EXCLUDED.river_name,
       source=EXCLUDED.source,created_at=EXCLUDED.created_at`,
    [r.id,r.latitude||null,r.longitude||null,r.elevation||null,r.river_distance||null,
     r.nearest_station_id||null,r.river_name||null,r.source||null,r.created_at||null]
  );
}

export async function upsertFloodPrediction(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO flood_predictions (id,prediction_id,latitude,longitude,rainfall,elevation,
       river_distance,flood_probability,flood_category,forecast_hours,model_version,predicted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET prediction_id=EXCLUDED.prediction_id,latitude=EXCLUDED.latitude,
       longitude=EXCLUDED.longitude,rainfall=EXCLUDED.rainfall,elevation=EXCLUDED.elevation,
       river_distance=EXCLUDED.river_distance,flood_probability=EXCLUDED.flood_probability,
       flood_category=EXCLUDED.flood_category,forecast_hours=EXCLUDED.forecast_hours,
       model_version=EXCLUDED.model_version,predicted_at=EXCLUDED.predicted_at`,
    [r.id,r.prediction_id||null,r.latitude||null,r.longitude||null,r.rainfall||null,
     r.elevation||null,r.river_distance||null,r.flood_probability||null,
     r.flood_category||null,r.forecast_hours||null,r.model_version||null,r.predicted_at||null]
  );
}

export async function upsertDisasterAlert(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO disaster_alerts (id,alert_type,severity,title,message,latitude,longitude,
       prediction_id,status,created_at,acknowledged_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET alert_type=EXCLUDED.alert_type,severity=EXCLUDED.severity,
       title=EXCLUDED.title,message=EXCLUDED.message,latitude=EXCLUDED.latitude,
       longitude=EXCLUDED.longitude,prediction_id=EXCLUDED.prediction_id,status=EXCLUDED.status,
       created_at=EXCLUDED.created_at,acknowledged_at=EXCLUDED.acknowledged_at`,
    [r.id,r.alert_type,r.severity,r.title||null,r.message||null,
     r.latitude||null,r.longitude||null,r.prediction_id||null,
     r.status||'ACTIVE',r.created_at||null,r.acknowledged_at||null]
  );
}

export async function upsertPredictionRequest(r) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO prediction_requests (id,request_id,request_type,input_data,status,
       response_data,requested_at,completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET request_id=EXCLUDED.request_id,request_type=EXCLUDED.request_type,
       input_data=EXCLUDED.input_data,status=EXCLUDED.status,response_data=EXCLUDED.response_data,
       requested_at=EXCLUDED.requested_at,completed_at=EXCLUDED.completed_at`,
    [r.id,r.request_id||null,r.request_type||null,r.input_data||null,
     r.status||'PENDING',r.response_data||null,r.requested_at||null,r.completed_at||null]
  );
}
