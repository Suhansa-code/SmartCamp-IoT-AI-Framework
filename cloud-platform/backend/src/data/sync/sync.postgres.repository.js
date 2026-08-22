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
