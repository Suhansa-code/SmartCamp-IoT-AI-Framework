import pg from 'pg';

const { Pool } = pg;

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host:     process.env.PGHOST || 'localhost',
      port:     parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'smartcamp',
      user:     process.env.PGUSER || 'smartcamp_app',
      password: process.env.PGPASSWORD || undefined,
    });

pool.on('error', err => console.error('[DB] Idle client error:', err.message));

/**
 * Initialize database schema
 * Creates tables if they don't exist
 */
async function initSchema() {
  try {
    await pool.query(`
      -- Alerts pipeline (synced from raspberry platform via HTTP)
      CREATE TABLE IF NOT EXISTS pages_alerts (
        alert_id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL,
        res_id TEXT,
        camp_id TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        trigger_detail TEXT,
        triggered_at TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'resolved')),
        resolved_at TEXT,
        resolved_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON pages_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_alerts_camp ON pages_alerts(camp_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_triggered ON pages_alerts(triggered_at DESC);

      CREATE TABLE IF NOT EXISTS pages_children (
        child_id TEXT PRIMARY KEY,
        res_id TEXT,
        camp_id TEXT,
        grade INTEGER,
        language TEXT,
        baseline_score REAL,
        total_sessions INTEGER DEFAULT 0,
        alert_status TEXT DEFAULT 'none',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pages_sessions (
        session_id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL REFERENCES pages_children(child_id),
        composite_score REAL,
        anomaly_flagged BOOLEAN DEFAULT FALSE,
        alert_triggered BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_child ON pages_sessions(child_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_created ON pages_sessions(created_at DESC);

      -- Live camp data pipeline (from EMQX: smartcamp/registration/*, smartcamp/distribution/log)
      CREATE TABLE IF NOT EXISTS persons (
        person_id TEXT PRIMARY KEY,
        fingerprint_id TEXT,
        full_name TEXT NOT NULL,
        age INTEGER,
        gender TEXT,
        person_type TEXT,
        family_unit_id TEXT,
        family_size INTEGER,
        is_pregnant BOOLEAN DEFAULT FALSE,
        has_chronic_illness BOOLEAN DEFAULT FALSE,
        medical_notes TEXT,
        pre_registered BOOLEAN DEFAULT FALSE,
        wristband_barcode TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ,
        last_checkin_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_persons_wristband ON persons(wristband_barcode);

      CREATE TABLE IF NOT EXISTS distributions (
        id BIGSERIAL PRIMARY KEY,
        person_id TEXT REFERENCES persons(person_id),
        person_name TEXT,
        barcode TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        quantity NUMERIC,
        distributed_at TIMESTAMPTZ NOT NULL,
        distributed_date DATE GENERATED ALWAYS AS ((distributed_at AT TIME ZONE 'UTC')::date) STORED,
        UNIQUE(barcode, resource_type, distributed_date)
      );
      CREATE INDEX IF NOT EXISTS idx_distributions_date ON distributions(distributed_date);

      CREATE TABLE IF NOT EXISTS daily_snapshots (
        snapshot_date DATE PRIMARY KEY,
        total_persons INTEGER,
        new_registrations INTEGER,
        checkins INTEGER,
        attendance_rate REAL,
        distributions JSONB
      );

      -- Raw audit log of every MQTT message received, regardless of topic
      CREATE TABLE IF NOT EXISTS mqtt_events (
        id BIGSERIAL PRIMARY KEY,
        topic TEXT NOT NULL,
        payload JSONB,
        received_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_mqtt_events_topic ON mqtt_events(topic, received_at DESC);
    `);

    console.log('[DB] ✅ Schema initialized successfully');
  } catch (err) {
    console.error('[DB] ❌ Failed to initialize schema:', err.message);
    throw err;
  }
}

// ── Alerts pipeline ──────────────────────────────────────────────────────────

async function getAlerts(status = null, campId = null) {
  let query = `
    SELECT
      a.alert_id, a.child_id, a.res_id, a.camp_id, a.alert_type,
      a.trigger_detail, a.triggered_at, a.status, a.resolved_at, a.resolved_notes,
      c.grade, c.language, c.baseline_score
    FROM pages_alerts a
    LEFT JOIN pages_children c ON a.child_id = c.child_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    params.push(status);
    query += ` AND a.status = $${params.length}`;
  }
  if (campId && campId !== 'all') {
    params.push(campId);
    query += ` AND a.camp_id = $${params.length}`;
  }
  query += ` ORDER BY a.triggered_at DESC`;

  try {
    const { rows: alerts } = await pool.query(query, params);

    const enhanced = [];
    for (const alert of alerts) {
      const { rows: recentSessions } = await pool.query(
        `SELECT composite_score FROM pages_sessions
         WHERE child_id = $1 AND composite_score IS NOT NULL
         ORDER BY created_at DESC LIMIT 5`,
        [alert.child_id]
      );
      const recent_scores = recentSessions
        .map(s => (s.composite_score !== null ? Math.round(s.composite_score) : null))
        .filter(s => s !== null)
        .reverse();

      enhanced.push({
        ...alert,
        recent_scores,
        trigger_detail: alert.trigger_detail ? JSON.parse(alert.trigger_detail) : null,
      });
    }
    return enhanced;
  } catch (err) {
    console.error('[DB] Failed to get alerts:', err.message);
    throw err;
  }
}

async function getAlert(alertId) {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, c.grade, c.language, c.baseline_score
       FROM pages_alerts a
       LEFT JOIN pages_children c ON a.child_id = c.child_id
       WHERE a.alert_id = $1`,
      [alertId]
    );
    const alert = rows[0] || null;
    if (alert && alert.trigger_detail) alert.trigger_detail = JSON.parse(alert.trigger_detail);
    return alert;
  } catch (err) {
    console.error('[DB] Failed to get alert:', err.message);
    throw err;
  }
}

async function upsertAlert(alertData) {
  const { alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at } = alertData;
  try {
    await pool.query(
      `INSERT INTO pages_alerts
         (alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       ON CONFLICT (alert_id) DO UPDATE SET
         status = 'pending',
         trigger_detail = EXCLUDED.trigger_detail`,
      [
        alert_id, child_id, res_id, camp_id, alert_type,
        typeof trigger_detail === 'string' ? trigger_detail : JSON.stringify(trigger_detail),
        triggered_at,
      ]
    );
    console.log(`[DB] ✅ Upserted alert ${alert_id}`);
    return { success: true, alert_id };
  } catch (err) {
    console.error('[DB] Failed to upsert alert:', err.message);
    throw err;
  }
}

async function resolveAlert(alertId, notes = null) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE pages_alerts SET status = 'resolved', resolved_at = NOW()::text, resolved_notes = $1
       WHERE alert_id = $2`,
      [notes, alertId]
    );
    if (rowCount > 0) console.log(`[DB] ✅ Resolved alert ${alertId}`);
    return rowCount > 0;
  } catch (err) {
    console.error('[DB] Failed to resolve alert:', err.message);
    throw err;
  }
}

async function syncChildren(children) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const child of children) {
      await client.query(
        `INSERT INTO pages_children (child_id, res_id, camp_id, grade, language, baseline_score)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (child_id) DO UPDATE SET
           grade = EXCLUDED.grade,
           language = EXCLUDED.language,
           baseline_score = EXCLUDED.baseline_score`,
        [child.child_id, child.res_id, child.camp_id, child.grade, child.language, child.baseline_score]
      );
    }
    await client.query('COMMIT');
    console.log(`[DB] ✅ Synced ${children.length} children`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Failed to sync children:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function syncSessions(sessions) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const session of sessions) {
      await client.query(
        `INSERT INTO pages_sessions (session_id, child_id, composite_score, anomaly_flagged, alert_triggered, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_id) DO UPDATE SET
           composite_score = EXCLUDED.composite_score,
           anomaly_flagged = EXCLUDED.anomaly_flagged,
           alert_triggered = EXCLUDED.alert_triggered`,
        [
          session.session_id, session.child_id, session.composite_score,
          !!session.anomaly_flagged, !!session.alert_triggered, session.created_at,
        ]
      );
    }
    await client.query('COMMIT');
    console.log(`[DB] ✅ Synced ${sessions.length} sessions`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Failed to sync sessions:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ── Live camp data pipeline (MQTT-sourced) ───────────────────────────────────

async function upsertPerson(person, wristband_barcode) {
  try {
    await pool.query(
      `INSERT INTO persons
         (person_id, fingerprint_id, full_name, age, gender, person_type, family_unit_id,
          family_size, is_pregnant, has_chronic_illness, medical_notes, pre_registered,
          wristband_barcode, is_active, created_at, last_checkin_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
       ON CONFLICT (person_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         age = EXCLUDED.age,
         gender = EXCLUDED.gender,
         person_type = EXCLUDED.person_type,
         family_unit_id = EXCLUDED.family_unit_id,
         family_size = EXCLUDED.family_size,
         is_pregnant = EXCLUDED.is_pregnant,
         has_chronic_illness = EXCLUDED.has_chronic_illness,
         medical_notes = EXCLUDED.medical_notes,
         wristband_barcode = COALESCE(EXCLUDED.wristband_barcode, persons.wristband_barcode),
         is_active = EXCLUDED.is_active,
         last_checkin_at = NOW(),
         updated_at = NOW()`,
      [
        person.id, person.fingerprint_id, person.full_name, person.age, person.gender,
        person.person_type, person.family_unit_id, person.family_size,
        !!person.is_pregnant, !!person.has_chronic_illness, person.medical_notes,
        !!person.pre_registered, wristband_barcode || null, person.is_active !== false,
        person.created_at || null,
      ]
    );
  } catch (err) {
    console.error('[DB] Failed to upsert person:', err.message);
    throw err;
  }
}

/** Returns true if this was a new distribution (not a duplicate for barcode+type+day). */
async function recordDistribution({ person_id, person_name, barcode, resource_type, quantity, distributed_at }) {
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO distributions (person_id, person_name, barcode, resource_type, quantity, distributed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (barcode, resource_type, distributed_date) DO NOTHING`,
      [person_id || null, person_name || null, barcode, resource_type, quantity || null, distributed_at || new Date()]
    );
    return rowCount > 0;
  } catch (err) {
    console.error('[DB] Failed to record distribution:', err.message);
    throw err;
  }
}

async function upsertDailySnapshot(snapshot) {
  try {
    await pool.query(
      `INSERT INTO daily_snapshots (snapshot_date, total_persons, new_registrations, checkins, attendance_rate, distributions)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (snapshot_date) DO UPDATE SET
         total_persons = EXCLUDED.total_persons,
         new_registrations = EXCLUDED.new_registrations,
         checkins = EXCLUDED.checkins,
         attendance_rate = EXCLUDED.attendance_rate,
         distributions = EXCLUDED.distributions`,
      [
        snapshot.date, snapshot.total_persons, snapshot.new_registrations,
        snapshot.checkins, snapshot.attendance_rate, JSON.stringify(snapshot.distributions),
      ]
    );
  } catch (err) {
    console.error('[DB] Failed to upsert daily snapshot:', err.message);
    throw err;
  }
}

/** Fire-and-forget raw log of every MQTT message, keyed by topic. Never throws. */
function logMqttEvent(topic, payload) {
  pool.query(
    `INSERT INTO mqtt_events (topic, payload) VALUES ($1, $2)`,
    [topic, JSON.stringify(payload)]
  ).catch(err => console.error('[DB] Failed to log mqtt event:', err.message));
}

/** Rehydrate in-memory camp state from Postgres after a restart. */
async function loadCampState() {
  const [{ rows: persons }, { rows: todaysDistributions }, { rows: dailySnapshots }] = await Promise.all([
    pool.query(`SELECT * FROM persons WHERE is_active = TRUE`),
    pool.query(`SELECT barcode, resource_type, distributed_date FROM distributions WHERE distributed_date = CURRENT_DATE`),
    pool.query(`SELECT * FROM daily_snapshots ORDER BY snapshot_date DESC LIMIT 30`),
  ]);
  return { persons, todaysDistributions, dailySnapshots: dailySnapshots.reverse() };
}

// Initialize schema on import
const schemaReady = initSchema();

export {
  pool,
  schemaReady,
  getAlerts,
  getAlert,
  upsertAlert,
  resolveAlert,
  syncChildren,
  syncSessions,
  upsertPerson,
  recordDistribution,
  upsertDailySnapshot,
  logMqttEvent,
  loadCampState,
};
