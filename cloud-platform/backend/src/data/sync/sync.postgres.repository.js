/**
 * sync.postgres.repository.js — Idempotent PostgreSQL upserts for all sync entities.
 *
 * Each function uses ON CONFLICT ... DO UPDATE to safely handle duplicate
 * MQTT deliveries. The sync_log table tracks received sync_ids.
 */
import { getPool } from '../../config/database.js';
import { randomUUID } from 'crypto';

const EDUCATION_ALERT_CONSECUTIVE = 3;
const EDUCATION_ALERT_OF_FIVE = 3;

/**
 * Guard a value bound to a TIMESTAMPTZ column.
 *
 * The Pi stores every timestamp as SQLite TEXT, so a field that was written
 * wrong once — the weather rows carrying the literal `GMT` are the live
 * example — reaches Postgres as `invalid input syntax for type timestamp with
 * time zone`. That aborts the whole statement, the record never acks, and the
 * Pi re-queues it forever (see ackFailed in the Pi's sync-manager).
 *
 * One unparseable field must not cost the entire record, so an unrecognisable
 * value becomes NULL and the rest of the row still lands. Anything that IS
 * date-shaped is passed through byte-for-byte rather than re-serialised: node
 * would read a bare SQL datetime (`2026-08-29 12:34:56`) as workstation-local
 * time and silently shift every historical row by the UTC offset.
 */
function ts(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return Number.isFinite(v) ? new Date(v) : null;
  const s = String(v).trim();
  // ISO-8601 or the SQL datetime shape SQLite's CURRENT_TIMESTAMP produces.
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(s)) return null;
  return Number.isNaN(new Date(s.replace(' ', 'T')).getTime()) ? null : s;
}

export async function isSyncProcessed(syncId) {
  const pool = getPool();
  const result = await pool.query('SELECT 1 FROM sync_log WHERE sync_id = $1', [syncId]);
  return result.rowCount > 0;
}

export async function logSync(syncId, entity, localId, campId, operation, deviceId, priority) {
  const pool = getPool();
  const safePriority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(priority)
    ? priority
    : 'MEDIUM';
  await pool.query(
    `INSERT INTO sync_log (sync_id, entity, local_id, camp_id, device_id, operation, status, priority, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'processed', $7, NOW())
     ON CONFLICT (sync_id) DO NOTHING`,
    [syncId, entity, String(localId), campId || null, deviceId || null, operation, safePriority]
  );
}

export async function listSyncEvents({ priority, campId, limit = 100 } = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  if (priority) {
    params.push(priority);
    conditions.push(`priority = $${params.length}`);
  }
  if (campId) {
    params.push(campId);
    conditions.push(`camp_id = $${params.length}`);
  }

  params.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT sync_id, entity, local_id, camp_id, device_id, operation, status, priority, received_at
     FROM sync_log ${where}
     ORDER BY CASE priority
       WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3
     END, received_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}

export async function upsertNetworkStatus(r, ctx = {}) {
  const deviceId = ctx.device_id || r.device_id;
  if (!deviceId) throw new Error('network status is missing device_id');

  const pool = getPool();
  await pool.query(
    `INSERT INTO network_status
      (device_id, camp_id, state, raw_state, metrics, qos_policy, reachability, buffered_messages, observed_at, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
     ON CONFLICT (device_id) DO UPDATE SET
       camp_id = EXCLUDED.camp_id,
       state = EXCLUDED.state,
       raw_state = EXCLUDED.raw_state,
       metrics = EXCLUDED.metrics,
       qos_policy = EXCLUDED.qos_policy,
       reachability = EXCLUDED.reachability,
       buffered_messages = EXCLUDED.buffered_messages,
       observed_at = EXCLUDED.observed_at,
       received_at = CURRENT_TIMESTAMP
     WHERE EXCLUDED.observed_at >= network_status.observed_at`,
    [
      deviceId,
      ctx.camp_id || r.camp_id || null,
      r.state,
      r.raw_state || null,
      r.metrics || null,
      r.qos_policy || null,
      r.reachability || null,
      Number.isInteger(r.buffered_messages) ? r.buffered_messages : 0,
      ts(r.observed_at) || new Date(),
    ],
  );
}

export async function listNetworkStatuses() {
  const result = await getPool().query(
    `SELECT device_id, camp_id, state, raw_state, metrics, qos_policy, reachability,
            buffered_messages, observed_at, received_at
     FROM network_status
     ORDER BY observed_at DESC`,
  );
  return result.rows;
}

// ── Device registry ──────────────────────────────────────────────────────

export async function upsertDevice(deviceId, campId, name) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO devices (device_id, camp_id, name, status, registered_at, updated_at)
     VALUES ($1, $2, $3, 'active', NOW(), NOW())
     ON CONFLICT (device_id) DO UPDATE SET camp_id = EXCLUDED.camp_id,
       name = COALESCE(EXCLUDED.name, devices.name),
       status = 'active', updated_at = NOW()`,
    [deviceId, campId, name || null]
  );
}

export async function getDeviceCampId(deviceId) {
  const pool = getPool();
  const result = await pool.query('SELECT camp_id FROM devices WHERE device_id = $1', [deviceId]);
  return result.rows[0]?.camp_id || null;
}

export async function getBehavioralSignals(sessionId) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT accuracy_rate, false_tap_rate, avg_reaction_time, reaction_variance, idle_time_ratio, rapid_click_count, time_to_first_ms, completion_ratio FROM pages_behavioral_signals WHERE session_id = $1 LIMIT 1',
    [sessionId]
  );
  return result.rows[0] || null;
}

// ── Resource domain ──────────────────────────────────────────────────────

export async function upsertPerson(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO persons (id,fingerprint_id,full_name,age,gender,family_unit_id,family_size,
       is_pregnant,has_chronic_illness,medical_notes,person_type,is_active,registration_date,
        mqtt_client_id,mqtt_password,created_at,device_id,camp_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (id) DO UPDATE SET fingerprint_id=EXCLUDED.fingerprint_id,
       full_name=EXCLUDED.full_name,age=EXCLUDED.age,gender=EXCLUDED.gender,
       family_unit_id=EXCLUDED.family_unit_id,family_size=EXCLUDED.family_size,
       is_pregnant=EXCLUDED.is_pregnant,has_chronic_illness=EXCLUDED.has_chronic_illness,
       medical_notes=EXCLUDED.medical_notes,person_type=EXCLUDED.person_type,
       is_active=EXCLUDED.is_active,registration_date=EXCLUDED.registration_date,
       mqtt_client_id=EXCLUDED.mqtt_client_id,mqtt_password=EXCLUDED.mqtt_password,
        created_at=EXCLUDED.created_at,device_id=EXCLUDED.device_id,camp_id=EXCLUDED.camp_id`,
    [r.id,r.fingerprint_id,r.full_name,r.age,r.gender||null,r.family_unit_id||null,
     r.family_size||1,r.is_pregnant||0,r.has_chronic_illness||0,r.medical_notes||null,
     r.person_type||'refugee',r.is_active??1,r.registration_date||null,
     r.mqtt_client_id||null,r.mqtt_password||null,ts(r.created_at),
      ctx.device_id||r.device_id||null,ctx.camp_id||r.camp_id||null]
  );
}

export async function upsertCheckin(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO camp_checkins (id,person_id,checkin_time,camp_day,is_new_arrival,device_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET person_id=EXCLUDED.person_id,
       checkin_time=EXCLUDED.checkin_time,camp_day=EXCLUDED.camp_day,
       is_new_arrival=EXCLUDED.is_new_arrival,device_id=EXCLUDED.device_id`,
    [r.id,r.person_id||null,ts(r.checkin_time),r.camp_day||1,r.is_new_arrival??1,
     ctx.device_id||r.device_id||null]
  );
}

/**
 * Wristbands have TWO identities the Pi can collide on: `id` (the PRIMARY KEY)
 * and `barcode` (UNIQUE NOT NULL, the number printed on the physical band).
 *
 * A single statement can only name one conflict target. `ON CONFLICT (id)`
 * alone is what produced the live
 * `duplicate key value violates unique constraint "wristbands_barcode_key"`
 * failures: a band re-created on the Pi keeps its printed barcode but takes a
 * new rowid, so the id target never fires and Postgres raises the barcode
 * violation instead. The record then never acks and the Pi retries it forever.
 *
 * The barcode is the durable identity — it is physically printed and cannot
 * change — so a barcode collision resolves onto the existing row rather than
 * fighting the constraint. The id-keyed upsert stays the fast path.
 */
export async function upsertWristband(r) {
  const pool = getPool();
  const params = [r.id,r.person_id||null,r.barcode,r.qr_identifier||null,r.status||'AVAILABLE',
    ts(r.issued_at),ts(r.assigned_at),r.is_active??1];

  try {
    await pool.query(
      `INSERT INTO wristbands (id,person_id,barcode,qr_identifier,status,issued_at,assigned_at,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET person_id=EXCLUDED.person_id,barcode=EXCLUDED.barcode,
         qr_identifier=EXCLUDED.qr_identifier,status=EXCLUDED.status,issued_at=EXCLUDED.issued_at,
         assigned_at=EXCLUDED.assigned_at,is_active=EXCLUDED.is_active`,
      params
    );
  } catch (err) {
    // 23505 = unique_violation. Only the barcode index is worth recovering
    // from; anything else is a genuine error and must still surface.
    if (err.code !== '23505' || err.constraint !== 'wristbands_barcode_key') throw err;

    // Renumbered deliberately. Reusing the INSERT's numbering here left $1
    // (the id) referenced nowhere in the statement, and Postgres cannot infer
    // a type for a parameter it never sees: every recovery attempt died with
    // 42P18 "could not determine data type of parameter $1". The collision it
    // was written to repair therefore never got repaired, and the row retried
    // until it exhausted its backoff.
    const [, personId, barcode, qrIdentifier, status, issuedAt, assignedAt, isActive] = params;
    await pool.query(
      `UPDATE wristbands SET person_id=$1,qr_identifier=$2,status=$3,
         issued_at=$4,assigned_at=$5,is_active=$6
       WHERE barcode=$7`,
      [personId, qrIdentifier, status, issuedAt, assignedAt, isActive, barcode]
    );
  }
}

export async function upsertDistribution(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO distributions (id,wristband_barcode,resource_type,quantity,distributed_at,device_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET wristband_barcode=EXCLUDED.wristband_barcode,
       resource_type=EXCLUDED.resource_type,quantity=EXCLUDED.quantity,
       distributed_at=EXCLUDED.distributed_at,device_id=EXCLUDED.device_id`,
    [r.id,r.wristband_barcode||null,r.resource_type,r.quantity,ts(r.distributed_at),
     ctx.device_id||r.device_id||null]
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
     ts(r.created_at),ts(r.updated_at)]
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
     r.recorded_by||null,ts(r.created_at)]
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
     r.wristband_id||null,r.quantity||null,r.details||null,ts(r.created_at)]
  );
}

// ── Education domain ─────────────────────────────────────────────────────

export async function upsertChild(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO children (child_id,res_id,camp_id,grade,language,baseline_score,total_sessions,alert_status,device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (child_id) DO UPDATE SET res_id=EXCLUDED.res_id,camp_id=EXCLUDED.camp_id,
       grade=EXCLUDED.grade,language=EXCLUDED.language,baseline_score=EXCLUDED.baseline_score,
       total_sessions=EXCLUDED.total_sessions,alert_status=EXCLUDED.alert_status,
       device_id=EXCLUDED.device_id`,
    [r.child_id,r.res_id||null,r.camp_id,r.grade||null,r.language||null,
     r.baseline_score||null,r.total_sessions||0,r.alert_status||'none',
     ctx.device_id||r.device_id||null]
  );
}

/**
 * Make sure a session's parent child row exists before the session lands.
 *
 * sessions.child_id is `NOT NULL REFERENCES children (child_id)`, and each
 * entity syncs on its own topic with no ordering between them — so a session
 * routinely arrives before the child that owns it and dies on
 * `sessions_child_id_fkey`. It then never acks, and the Pi re-queues it on
 * every cycle; that constraint accounted for a large share of the error ACKs
 * on the live deployment.
 *
 * The stub carries only what the schema demands. `children` upserts with
 * `ON CONFLICT (child_id) DO UPDATE`, so the real row overwrites this the
 * moment it arrives, whichever order the two land in.
 */
async function ensureChild(pool, childId, campId, deviceId) {
  if (!childId) return;
  await pool.query(
    `INSERT INTO children (child_id, camp_id, device_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (child_id) DO NOTHING`,
    [childId, campId || 'UNKNOWN', deviceId || null]
  );
}

export async function upsertSession(r, ctx = {}) {
  const pool = getPool();
  const createdAt = ts(r.created_at) || new Date().toISOString();
  await ensureChild(pool, r.child_id, ctx.camp_id || r.camp_id, ctx.device_id || r.device_id);
  await pool.query(
    `INSERT INTO sessions (session_id,child_id,composite_score,task_score,passive_score,
       gate_decision,z_score,if_score,anomaly_flagged,alert_triggered,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (session_id) DO UPDATE SET child_id=EXCLUDED.child_id,
       composite_score=EXCLUDED.composite_score,task_score=EXCLUDED.task_score,
       passive_score=EXCLUDED.passive_score,gate_decision=EXCLUDED.gate_decision,
       z_score=EXCLUDED.z_score,if_score=EXCLUDED.if_score,
       anomaly_flagged=EXCLUDED.anomaly_flagged,alert_triggered=EXCLUDED.alert_triggered,
       created_at=EXCLUDED.created_at`,
    [r.session_id,r.child_id,r.composite_score||null,r.task_score||null,
     r.passive_score||null,r.gate_decision||null,r.z_score||null,r.if_score||null,
     r.anomaly_flagged||0,r.alert_triggered||0,createdAt]
  );

  await maybeGenerateEducationAlerts(pool, r.child_id, r.session_id);
}

async function maybeGenerateEducationAlerts(pool, childId, sessionId) {
  if (!childId) return;

  const childRes = await pool.query(
    'SELECT child_id, res_id, camp_id FROM children WHERE child_id = $1',
    [childId]
  );
  const child = childRes.rows[0];
  if (!child) return;

  const recentRes = await pool.query(
    `SELECT session_id, anomaly_flagged
     FROM sessions
     WHERE child_id = $1 AND composite_score IS NOT NULL
     ORDER BY created_at DESC NULLS LAST
     LIMIT 5`,
    [childId]
  );

  const recent = recentRes.rows;
  if (recent.length === 0) return;

  const flags = recent.map((s) => Number(s.anomaly_flagged) === 1);
  const latestWindow = flags.slice(0, EDUCATION_ALERT_CONSECUTIVE);
  const hasConsecutive =
    latestWindow.length >= EDUCATION_ALERT_CONSECUTIVE && latestWindow.every(Boolean);

  let createdAny = false;

  if (hasConsecutive) {
    const created = await createPendingAlertIfMissing(pool, {
      childId,
      resId: child.res_id,
      campId: child.camp_id,
      alertType: '3_consecutive_flagged',
      triggerDetail: {
        session_id: sessionId,
        message: `${EDUCATION_ALERT_CONSECUTIVE} consecutive anomaly-flagged sessions`,
      },
    });
    createdAny = createdAny || created;
  }

  if (recent.length >= 5) {
    const flaggedCount = flags.filter(Boolean).length;
    if (flaggedCount >= EDUCATION_ALERT_OF_FIVE) {
      const created = await createPendingAlertIfMissing(pool, {
        childId,
        resId: child.res_id,
        campId: child.camp_id,
        alertType: '3_of_5_flagged',
        triggerDetail: {
          session_id: sessionId,
          message: `${flaggedCount}/5 recent sessions flagged`,
        },
      });
      createdAny = createdAny || created;
    }
  }

  if (createdAny) {
    await pool.query('UPDATE sessions SET alert_triggered = 1 WHERE session_id = $1', [sessionId]);
    await pool.query("UPDATE children SET alert_status = 'active' WHERE child_id = $1", [childId]);
  }
}

async function createPendingAlertIfMissing(pool, { childId, resId, campId, alertType, triggerDetail }) {
  const existing = await pool.query(
    `SELECT 1 FROM alerts
     WHERE child_id = $1 AND alert_type = $2 AND status = 'pending'
     LIMIT 1`,
    [childId, alertType]
  );
  if (existing.rowCount > 0) return false;

  await pool.query(
    `INSERT INTO alerts (alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at, status)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), 'pending')`,
    [randomUUID(), childId, resId || null, campId, alertType, JSON.stringify(triggerDetail || {})]
  );

  return true;
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
     r.composite_score,r.decision,ts(r.decided_at)]
  );
}

export async function upsertAlert(r, ctx = {}) {
  const pool = getPool();
  // alerts.child_id carries the same FK to children as sessions does, and
  // alerts outrank children in the Pi's priority order — so they arrive first
  // far more often than not.
  await ensureChild(pool, r.child_id, r.camp_id || ctx.camp_id, ctx.device_id || r.device_id);
  await pool.query(
    `INSERT INTO alerts (alert_id,child_id,res_id,camp_id,alert_type,trigger_detail,triggered_at,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (alert_id) DO UPDATE SET child_id=EXCLUDED.child_id,res_id=EXCLUDED.res_id,
       camp_id=EXCLUDED.camp_id,alert_type=EXCLUDED.alert_type,
       trigger_detail=EXCLUDED.trigger_detail,triggered_at=EXCLUDED.triggered_at,
       status=EXCLUDED.status`,
    [r.alert_id,r.child_id,r.res_id||null,r.camp_id,r.alert_type||null,
     JSON.stringify(r.trigger_detail||{}),ts(r.triggered_at),r.status||'pending']
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
     r.is_correct||0,r.time_taken_ms,ts(r.responded_at)]
  );
}

// ── Disaster domain ─────────────────────────────────────────────────────

export async function upsertDisasterEvent(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO disaster_events (id,event_type,status,severity,location_lat,location_lng,
       started_at,ended_at,created_at,updated_at,device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET event_type=EXCLUDED.event_type,status=EXCLUDED.status,
       severity=EXCLUDED.severity,location_lat=EXCLUDED.location_lat,location_lng=EXCLUDED.location_lng,
       started_at=EXCLUDED.started_at,ended_at=EXCLUDED.ended_at,
       created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at,device_id=EXCLUDED.device_id`,
    [r.id,r.event_type,r.status||'ACTIVE',r.severity||null,
     r.location_lat||null,r.location_lng||null,
     ts(r.started_at),ts(r.ended_at),ts(r.created_at),ts(r.updated_at),
     ctx.device_id||r.device_id||null]
  );
}

export async function upsertSensorReading(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO sensor_readings (id,sensor_id,sensor_type,value,unit,latitude,longitude,recorded_at,device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET sensor_id=EXCLUDED.sensor_id,sensor_type=EXCLUDED.sensor_type,
       value=EXCLUDED.value,unit=EXCLUDED.unit,latitude=EXCLUDED.latitude,
       longitude=EXCLUDED.longitude,recorded_at=EXCLUDED.recorded_at,device_id=EXCLUDED.device_id`,
    [r.id, r.sensor_id, r.sensor_type, r.value, r.unit ?? null, r.latitude ?? null,
      r.longitude ?? null, ts(r.recorded_at), ctx.device_id||r.device_id||null],
  );
}

export async function upsertEnvironmentalData(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO environmental_data (id,temperature,humidity,pressure,rainfall,wind_speed,wind_direction,recorded_at,source,device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET temperature=EXCLUDED.temperature,humidity=EXCLUDED.humidity,
       pressure=EXCLUDED.pressure,rainfall=EXCLUDED.rainfall,wind_speed=EXCLUDED.wind_speed,
       wind_direction=EXCLUDED.wind_direction,recorded_at=EXCLUDED.recorded_at,source=EXCLUDED.source,
       device_id=EXCLUDED.device_id`,
    [r.id, r.temperature ?? null, r.humidity ?? null, r.pressure ?? null, r.rainfall ?? null,
      r.wind_speed ?? null, r.wind_direction ?? null, ts(r.recorded_at), r.source ?? null,
      ctx.device_id||r.device_id||null],
  );
}

export async function upsertWaterLevelReading(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO water_level_readings (id,station_id,water_level,unit,latitude,longitude,recorded_at,source,device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET station_id=EXCLUDED.station_id,water_level=EXCLUDED.water_level,
       unit=EXCLUDED.unit,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
       recorded_at=EXCLUDED.recorded_at,source=EXCLUDED.source,device_id=EXCLUDED.device_id`,
    [r.id,r.station_id||null,r.water_level,r.unit||null,
     r.latitude||null,r.longitude||null,ts(r.recorded_at),r.source||null,
     ctx.device_id||r.device_id||null]
  );
}

export async function upsertGpsReading(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO gps_readings (id,device_id,latitude,longitude,altitude,accuracy,source,recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET device_id=EXCLUDED.device_id,latitude=EXCLUDED.latitude,
       longitude=EXCLUDED.longitude,altitude=EXCLUDED.altitude,accuracy=EXCLUDED.accuracy,
       source=EXCLUDED.source,recorded_at=EXCLUDED.recorded_at`,
    [r.id,ctx.device_id||r.device_id||null,r.latitude,r.longitude,
     r.altitude||null,r.accuracy||null,r.source||'GPS_SENSOR',ts(r.recorded_at)]
  );
}

export async function upsertWeatherData(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO weather_data (id,latitude,longitude,temperature,precipitation,rainfall,
       wind_speed,weather_code,forecast_time,source,created_at,device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
       temperature=EXCLUDED.temperature,precipitation=EXCLUDED.precipitation,
       rainfall=EXCLUDED.rainfall,wind_speed=EXCLUDED.wind_speed,weather_code=EXCLUDED.weather_code,
       forecast_time=EXCLUDED.forecast_time,source=EXCLUDED.source,created_at=EXCLUDED.created_at,
       device_id=EXCLUDED.device_id`,
    [r.id,r.latitude||null,r.longitude||null,r.temperature||null,r.precipitation||null,
     r.rainfall||null,r.wind_speed||null,r.weather_code||null,
     ts(r.forecast_time),r.source||null,ts(r.created_at),
     ctx.device_id||r.device_id||null]
  );
}

export async function upsertHydrospatialData(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO hydrospatial_data (id,latitude,longitude,elevation,river_distance,
       nearest_station_id,river_name,source,created_at,device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
       elevation=EXCLUDED.elevation,river_distance=EXCLUDED.river_distance,
       nearest_station_id=EXCLUDED.nearest_station_id,river_name=EXCLUDED.river_name,
       source=EXCLUDED.source,created_at=EXCLUDED.created_at,device_id=EXCLUDED.device_id`,
    [r.id,r.latitude||null,r.longitude||null,r.elevation||null,r.river_distance||null,
     r.nearest_station_id||null,r.river_name||null,r.source||null,ts(r.created_at),
     ctx.device_id||r.device_id||null]
  );
}

export async function upsertFloodPrediction(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO flood_predictions (id,prediction_id,latitude,longitude,rainfall,elevation,
       river_distance,flood_probability,flood_category,forecast_hours,model_version,predicted_at,device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET prediction_id=EXCLUDED.prediction_id,latitude=EXCLUDED.latitude,
       longitude=EXCLUDED.longitude,rainfall=EXCLUDED.rainfall,elevation=EXCLUDED.elevation,
       river_distance=EXCLUDED.river_distance,flood_probability=EXCLUDED.flood_probability,
       flood_category=EXCLUDED.flood_category,forecast_hours=EXCLUDED.forecast_hours,
       model_version=EXCLUDED.model_version,predicted_at=EXCLUDED.predicted_at,
       device_id=EXCLUDED.device_id`,
    [r.id,r.prediction_id||null,r.latitude||null,r.longitude||null,r.rainfall||null,
     r.elevation||null,r.river_distance||null,r.flood_probability||null,
     r.flood_category||null,r.forecast_hours||null,r.model_version||null,ts(r.predicted_at),
     ctx.device_id||r.device_id||null]
  );
}

export async function upsertDisasterAlert(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO disaster_alerts (id,alert_id,event_id,camp_id,camp_name,alert_type,severity,priority,title,message,latitude,longitude,
       prediction_id,flood_probability,flood_probability_percent,risk_category,forecast_hours,rainfall,camp_elevation,river_distance_km,water_level,
       station_id,station_name,gauge_elevation,elevation_difference,gauge_distance_km,gauge_latitude,gauge_longitude,river_name,camp_latitude,camp_longitude,
       source,prediction_timestamp,expires_at,schema_version,status,created_at,acknowledged_at,mqtt_status,cloud_sync_status,device_id,temperature,humidity)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43)
    ON CONFLICT (id) DO UPDATE SET alert_id=EXCLUDED.alert_id,event_id=EXCLUDED.event_id,camp_id=EXCLUDED.camp_id,camp_name=EXCLUDED.camp_name,
       alert_type=EXCLUDED.alert_type,severity=EXCLUDED.severity,priority=EXCLUDED.priority,title=EXCLUDED.title,message=EXCLUDED.message,
       latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,prediction_id=EXCLUDED.prediction_id,flood_probability=EXCLUDED.flood_probability,
       flood_probability_percent=EXCLUDED.flood_probability_percent,risk_category=EXCLUDED.risk_category,forecast_hours=EXCLUDED.forecast_hours,
       rainfall=EXCLUDED.rainfall,camp_elevation=EXCLUDED.camp_elevation,river_distance_km=EXCLUDED.river_distance_km,water_level=EXCLUDED.water_level,
       station_id=EXCLUDED.station_id,station_name=EXCLUDED.station_name,gauge_elevation=EXCLUDED.gauge_elevation,elevation_difference=EXCLUDED.elevation_difference,
       gauge_distance_km=EXCLUDED.gauge_distance_km,gauge_latitude=EXCLUDED.gauge_latitude,gauge_longitude=EXCLUDED.gauge_longitude,river_name=EXCLUDED.river_name,
       camp_latitude=EXCLUDED.camp_latitude,camp_longitude=EXCLUDED.camp_longitude,source=EXCLUDED.source,prediction_timestamp=EXCLUDED.prediction_timestamp,
       expires_at=EXCLUDED.expires_at,schema_version=EXCLUDED.schema_version,status=EXCLUDED.status,created_at=EXCLUDED.created_at,acknowledged_at=EXCLUDED.acknowledged_at,
       mqtt_status=EXCLUDED.mqtt_status,cloud_sync_status='SYNCED',device_id=EXCLUDED.device_id,temperature=EXCLUDED.temperature,humidity=EXCLUDED.humidity`,
    [r.id,r.alert_id||null,r.event_id||null,r.camp_id||null,r.camp_name||null,r.alert_type,r.severity,r.priority||'NORMAL',r.title||null,r.message||null,
     r.latitude??null,r.longitude??null,r.prediction_id||null,r.flood_probability??null,r.flood_probability_percent??null,r.risk_category||null,r.forecast_hours??null,
     r.rainfall??null,r.camp_elevation??null,r.river_distance_km??null,r.water_level??null,r.station_id||null,r.station_name||null,r.gauge_elevation??null,
     r.elevation_difference??null,r.gauge_distance_km??null,r.gauge_latitude??null,r.gauge_longitude??null,r.river_name||null,r.camp_latitude??null,r.camp_longitude??null,
     r.source||null,ts(r.prediction_timestamp),ts(r.expires_at),r.schema_version||'1.0',r.status||'ACTIVE',ts(r.created_at),ts(r.acknowledged_at),r.mqtt_status||'DELIVERED',r.cloud_sync_status||'SYNCED',
     ctx.device_id||r.device_id||null,r.temperature??null,r.humidity??null]
  );
}

export async function upsertPredictionRequest(r, ctx = {}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO prediction_requests (id,request_id,request_type,input_data,status,
       response_data,requested_at,completed_at,device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET request_id=EXCLUDED.request_id,request_type=EXCLUDED.request_type,
       input_data=EXCLUDED.input_data,status=EXCLUDED.status,response_data=EXCLUDED.response_data,
       requested_at=EXCLUDED.requested_at,completed_at=EXCLUDED.completed_at,device_id=EXCLUDED.device_id`,
    [r.id,r.request_id||null,r.request_type||null,r.input_data||null,
     r.status||'PENDING',r.response_data||null,ts(r.requested_at),ts(r.completed_at),
     ctx.device_id||r.device_id||null]
  );
}
