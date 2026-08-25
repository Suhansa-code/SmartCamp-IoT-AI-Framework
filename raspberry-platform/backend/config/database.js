import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import logger from '../utils/logger.js';
import C from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function ensureDir(filePath) {
  const dir = path.dirname(path.resolve(rootDir, filePath));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ═════════════════════════════════════════════════════════════════════════════
// CAMP DB — resource management (persons, wristbands, distributions, etc.)
// ═════════════════════════════════════════════════════════════════════════════

ensureDir(C.CAMP_DB_PATH);
const campDb = new Database(path.resolve(rootDir, C.CAMP_DB_PATH), { timeout: 30000 });
campDb.pragma('journal_mode = WAL');
campDb.pragma('foreign_keys = ON');
campDb.pragma('synchronous = NORMAL');
campDb.pragma('busy_timeout = 30000');

function initializeCampDb() {
  campDb.exec(`
    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT,
      family_unit_id TEXT,
      family_size INTEGER DEFAULT 1,
      is_pregnant INTEGER DEFAULT 0,
      has_chronic_illness INTEGER DEFAULT 0,
      medical_notes TEXT,
      pre_registered INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS camp_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER REFERENCES persons(id),
      checkin_time TEXT DEFAULT (datetime('now')),
      camp_day INTEGER DEFAULT 1,
      is_new_arrival INTEGER DEFAULT 1,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wristbands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER REFERENCES persons(id),
      barcode TEXT UNIQUE NOT NULL,
      issued_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wristband_barcode TEXT REFERENCES wristbands(barcode),
      resource_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      distributed_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_dist_today ON distributions(wristband_barcode, distributed_at);

    CREATE TABLE IF NOT EXISTS mqtt_buffer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      payload TEXT NOT NULL,
      priority TEXT NOT NULL,
      qos INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      flushed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS prediction_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inputs TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT,
      result TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_pending (
      sync_id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      table_name TEXT NOT NULL,
      local_id TEXT NOT NULL,
      operation TEXT NOT NULL DEFAULT 'CREATE',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      camp_id TEXT,
      device_id TEXT,
      payload TEXT NOT NULL,
      published INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 5,
      next_retry_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      acked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_pending_retry
      ON sync_pending(published, retry_count, next_retry_at);
  `);

  campDb.exec('CREATE INDEX IF NOT EXISTS idx_sync_pending_table_local ON sync_pending(table_name, local_id)');

  try { campDb.exec("ALTER TABLE persons ADD COLUMN person_type TEXT DEFAULT 'refugee'"); } catch (_) {}
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_persons_type ON persons(person_type)');
  try { campDb.exec('ALTER TABLE persons ADD COLUMN mqtt_client_id TEXT'); } catch (_) {}
  try { campDb.exec('ALTER TABLE persons ADD COLUMN mqtt_password TEXT'); } catch (_) {}
  try { campDb.exec('ALTER TABLE persons ADD COLUMN is_active INTEGER DEFAULT 1'); } catch (_) {}
  try { campDb.exec("ALTER TABLE persons ADD COLUMN registration_date TEXT"); } catch (_) {}
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_persons_registration_date ON persons(registration_date)');
  campDb.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_mqtt_client_id
      ON persons(mqtt_client_id) WHERE mqtt_client_id IS NOT NULL
  `);

  // ── Fingerprint hardware: physical template slot on the R503 sensor (1..N) ──
  try { campDb.exec('ALTER TABLE persons ADD COLUMN fingerprint_slot INTEGER'); } catch (_) {}
  campDb.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_fingerprint_slot
      ON persons(fingerprint_slot) WHERE fingerprint_slot IS NOT NULL
  `);

  // ── Wristband upgrades: QR identifier, lifecycle status, assignment tracking ──
  try { campDb.exec('ALTER TABLE wristbands ADD COLUMN qr_identifier TEXT'); } catch (_) {}
  try { campDb.exec("ALTER TABLE wristbands ADD COLUMN status TEXT DEFAULT 'AVAILABLE'"); } catch (_) {}
  try { campDb.exec('ALTER TABLE wristbands ADD COLUMN assigned_at TEXT'); } catch (_) {}
  try { campDb.exec('ALTER TABLE wristbands ADD COLUMN updated_at TEXT'); } catch (_) {}
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_wristbands_qr_identifier ON wristbands(qr_identifier)');
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_wristbands_status ON wristbands(status)');

  campDb.exec(`
    CREATE TABLE IF NOT EXISTS wristband_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wristband_id INTEGER REFERENCES wristbands(id),
      person_id INTEGER REFERENCES persons(id),
      assigned_at TEXT DEFAULT (datetime('now')),
      unassigned_at TEXT,
      synced INTEGER DEFAULT 0
    );
  `);
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_assignments_wristband ON wristband_assignments(wristband_id)');
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_assignments_person ON wristband_assignments(person_id)');
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_assignments_active ON wristband_assignments(wristband_id, unassigned_at)');

  // ── Resource catalog (dynamic, not hard-coded) ──
  campDb.exec(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_name TEXT NOT NULL,
      category TEXT,
      unit TEXT DEFAULT 'portion',
      total_quantity REAL NOT NULL DEFAULT 0,
      available_quantity REAL NOT NULL DEFAULT 0,
      minimum_threshold REAL DEFAULT 0,
      status TEXT DEFAULT 'AVAILABLE',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
  `);
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_resources_name ON resources(resource_name)');
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status)');

  // ── Per-person resource consumption (inventory-aware) ──
  campDb.exec(`
    CREATE TABLE IF NOT EXISTS resource_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES persons(id),
      resource_id INTEGER NOT NULL REFERENCES resources(id),
      meal TEXT,
      quantity REAL NOT NULL,
      date TEXT NOT NULL DEFAULT (date('now')),
      time TEXT NOT NULL DEFAULT (time('now')),
      recorded_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
  `);
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_usage_person ON resource_usage(person_id, date)');
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_usage_resource ON resource_usage(resource_id)');
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_usage_date ON resource_usage(date)');
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_usage_meal ON resource_usage(person_id, meal, date)');

  // ── Audit log (who / what / whom / how much / when) ──
  campDb.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT,
      action TEXT NOT NULL,
      person_id INTEGER,
      resource_id INTEGER,
      wristband_id INTEGER,
      quantity REAL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
  `);
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)');
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_audit_person ON audit_logs(person_id)');
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)');

  backfillCampData();
  seedResources();

  const count = campDb.prepare('SELECT COUNT(*) as c FROM persons').get().c;
  if (count === 0) {
    const insert = campDb.prepare(`
      INSERT INTO persons (fingerprint_id, full_name, age, gender, family_unit_id,
        family_size, is_pregnant, has_chronic_illness, medical_notes, pre_registered)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const samples = [
      ['FP_0001', 'Kasun Perera', 34, 'M', 'FAM_001', 4, 0, 0, ''],
      ['FP_0002', 'Nimali Silva', 67, 'F', 'FAM_002', 2, 0, 1, 'Diabetes type 2'],
      ['FP_0003', 'Ravi Jayasuriya', 8, 'M', 'FAM_001', 4, 0, 0, ''],
      ['FP_0004', 'Tharushi Fernando', 28, 'F', 'FAM_003', 3, 1, 0, 'Pregnant 6 months'],
    ];
    for (const s of samples) insert.run(...s);
    logger.info('[CAMP DB] Seeded 4 sample persons.');
  }

  logger.info(`[CAMP DB] Initialised at ${C.CAMP_DB_PATH}`);
}

/**
 * One-time backfill so pre-existing wristbands work with the new QR + assignment
 * model. Keeps the legacy `barcode` / `person_id` columns authoritative so no
 * existing functionality breaks.
 */
function backfillCampData() {
  const rows = campDb.prepare('SELECT id, barcode, person_id FROM wristbands').all();
  const setQr = campDb.prepare('UPDATE wristbands SET qr_identifier = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const openAssignment = campDb.prepare(`
    INSERT INTO wristband_assignments (wristband_id, person_id, assigned_at) VALUES (?, ?, datetime('now'))
  `);

  for (const w of rows) {
    if (!w.barcode) continue;
    if (!w.qr_identifier) {
      // CAMP-WB000001 style — the QR contains ONLY this opaque identifier.
      setQr.run(`CAMP-${w.barcode}`, w.id);
    }
    // Backfill lifecycle status + an open assignment for legacy-issued bands.
    if (w.person_id) {
      campDb.prepare(
        "UPDATE wristbands SET status = 'ASSIGNED', assigned_at = COALESCE(assigned_at, datetime('now')) WHERE id = ? AND (status IS NULL OR status = 'AVAILABLE')"
      ).run(w.id);
      const active = campDb.prepare(
        'SELECT id FROM wristband_assignments WHERE wristband_id = ? AND unassigned_at IS NULL'
      ).get(w.id);
      if (!active) openAssignment.run(w.id, w.person_id);
    }
  }

  // Fixed reusable pool WB-0001 … WB-0100 (QR: CAMP-WB-0001 …) — idempotent.
  const poolCount = campDb.prepare("SELECT COUNT(*) as c FROM wristbands WHERE barcode LIKE 'WB-%'").get().c;
  if (poolCount === 0) {
    const insert = campDb.prepare(`
      INSERT INTO wristbands (barcode, qr_identifier, status, issued_at, updated_at)
      VALUES (?, ?, 'AVAILABLE', datetime('now'), datetime('now'))
    `);
    const pool = campDb.transaction(() => {
      for (let i = 1; i <= 100; i += 1) {
        const label = `WB-${String(i).padStart(4, '0')}`;
        insert.run(label, `CAMP-${label}`);
      }
    });
    pool();
    logger.info('[CAMP DB] Seeded wristband pool WB-0001 … WB-0100 (AVAILABLE).');
  }
}

/**
 * Seed a sensible default resource catalog on first boot (idempotent).
 */
function seedResources() {
  const count = campDb.prepare('SELECT COUNT(*) as c FROM resources').get().c;
  if (count > 0) return;

  const defaults = [
    { name: 'Rice',         category: 'Food',        unit: 'portion', total: 500, threshold: 50 },
    { name: 'Chicken',      category: 'Food',        unit: 'portion', total: 200, threshold: 30 },
    { name: 'Vegetables',   category: 'Food',        unit: 'portion', total: 300, threshold: 40 },
    { name: 'Water',        category: 'Beverage',    unit: 'bottle',  total: 1000, threshold: 100 },
    { name: 'Milk',         category: 'Beverage',    unit: 'packet',  total: 150, threshold: 25 },
    { name: 'Bread',        category: 'Food',        unit: 'loaf',    total: 120, threshold: 20 },
    { name: 'Paracetamol',  category: 'Medicine',    unit: 'strip',   total: 80, threshold: 15 },
  ];

  const insert = campDb.prepare(`
    INSERT INTO resources (resource_name, category, unit, total_quantity, available_quantity, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const seed = campDb.transaction(() => {
    for (const r of defaults) insert.run(r.name, r.category, r.unit, r.total, r.total, r.threshold);
  });
  seed();
  logger.info('[CAMP DB] Seeded default resource catalog.');
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGES DB — education system (children, sessions, behavioral signals, etc.)
// ═════════════════════════════════════════════════════════════════════════════

ensureDir(C.PAGES_DB_PATH);

const modelsDir = path.resolve(rootDir, C.MODELS_DIR);
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

let pagesDb;
try {
  pagesDb = new Database(path.resolve(rootDir, C.PAGES_DB_PATH), { timeout: 30000 });
  pagesDb.pragma('journal_mode = WAL');
  pagesDb.pragma('foreign_keys = ON');
  pagesDb.pragma('synchronous = NORMAL');
  pagesDb.pragma('busy_timeout = 30000');

  const schemaPath = path.resolve(rootDir, 'db/pages-schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    pagesDb.exec(schema);
    migrateSelectedAnswerConstraint(pagesDb);
    migrateAddQRCodeColumn(pagesDb);
    logger.info('[PAGES DB] Schema applied successfully');
  } else {
    logger.warn('[PAGES DB] pages-schema.sql not found — tables may not exist');
  }

  logger.info(`[PAGES DB] Connected: ${C.PAGES_DB_PATH}`);
} catch (err) {
  logger.error(`[PAGES DB] Initialisation failed: ${err.message}`);
  process.exit(1);
}

function migrateSelectedAnswerConstraint(db) {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='pages_content_responses'`).get();
  if (!row?.sql) return;
  if (!row.sql.includes("selected_answer IN ('a', 'b', 'c')")) return;

  const migrate = db.transaction(() => {
    db.exec(`ALTER TABLE pages_content_responses RENAME TO pages_content_responses_legacy`);
    db.exec(`CREATE TABLE pages_content_responses (
      response_id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES pages_sessions(session_id),
      child_id TEXT NOT NULL REFERENCES pages_children(child_id), task_id TEXT NOT NULL,
      selected_answer TEXT NOT NULL, is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
      time_taken_ms INTEGER NOT NULL, responded_at TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
      synced INTEGER NOT NULL DEFAULT 0
    )`);
    db.exec(`INSERT INTO pages_content_responses SELECT * FROM pages_content_responses_legacy`);
    db.exec(`DROP TABLE pages_content_responses_legacy`);
  });
  migrate();
  logger.info('[PAGES DB] Migrated pages_content_responses constraint');
}

function migrateAddQRCodeColumn(db) {
  const row = db.prepare('PRAGMA table_info(pages_children)').all();
  if (row.some(col => col.name === 'qr_code_data')) return;
  try {
    db.exec('ALTER TABLE pages_children ADD COLUMN qr_code_data TEXT');
    logger.info('[PAGES DB] Added qr_code_data column');
  } catch (err) {
    logger.warn(`[PAGES DB] Could not add qr_code_data: ${err.message}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// DISASTER DB — disaster monitoring (sensor readings, alerts, predictions, etc.)
// ═════════════════════════════════════════════════════════════════════════════

ensureDir(C.DISASTER_DB_PATH);

let disasterDb;
try {
  disasterDb = new Database(path.resolve(rootDir, C.DISASTER_DB_PATH), { timeout: 30000 });
  disasterDb.pragma('journal_mode = WAL');
  disasterDb.pragma('foreign_keys = ON');
  disasterDb.pragma('synchronous = NORMAL');
  disasterDb.pragma('busy_timeout = 30000');

  const disasterSchemaPath = path.resolve(rootDir, 'db/disaster-schema.sql');
  if (fs.existsSync(disasterSchemaPath)) {
    const disasterSchema = fs.readFileSync(disasterSchemaPath, 'utf8');
    disasterDb.exec(disasterSchema);
    logger.info('[DISASTER DB] Schema applied successfully');
  } else {
    logger.warn('[DISASTER DB] disaster-schema.sql not found — tables may not exist');
  }

  try { disasterDb.exec("ALTER TABLE gps_readings ADD COLUMN source TEXT DEFAULT 'GPS_SENSOR'"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE disaster_events ADD COLUMN synced INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
  const disasterAlertColumns = {
    alert_id: 'TEXT', event_id: 'TEXT', camp_id: 'TEXT', camp_name: 'TEXT', priority: "TEXT NOT NULL DEFAULT 'NORMAL'",
    flood_probability: 'REAL', flood_probability_percent: 'REAL', risk_category: 'TEXT', forecast_hours: 'INTEGER',
    rainfall: 'REAL', camp_elevation: 'REAL', river_distance_km: 'REAL', water_level: 'REAL', station_id: 'TEXT',
    station_name: 'TEXT', gauge_elevation: 'REAL', elevation_difference: 'REAL', gauge_distance_km: 'REAL',
    gauge_latitude: 'REAL', gauge_longitude: 'REAL', river_name: 'TEXT', camp_latitude: 'REAL', camp_longitude: 'REAL',
    source: 'TEXT', prediction_timestamp: 'TEXT', expires_at: 'TEXT', schema_version: "TEXT NOT NULL DEFAULT '1.0'",
    mqtt_status: "TEXT NOT NULL DEFAULT 'PENDING'", cloud_sync_status: "TEXT NOT NULL DEFAULT 'PENDING'",
  };
  for (const [column, definition] of Object.entries(disasterAlertColumns)) {
    try { disasterDb.exec(`ALTER TABLE disaster_alerts ADD COLUMN ${column} ${definition}`); } catch (_) {}
  }
  try { disasterDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_disaster_alerts_alert_id ON disaster_alerts(alert_id) WHERE alert_id IS NOT NULL'); } catch (_) {}
  try { disasterDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_disaster_alerts_event_id ON disaster_alerts(event_id) WHERE event_id IS NOT NULL'); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE weather_data ADD COLUMN device_id TEXT"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE weather_data ADD COLUMN humidity REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE weather_data ADD COLUMN wind_direction REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE weather_data ADD COLUMN condition TEXT"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE weather_data ADD COLUMN forecast_data TEXT"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE weather_data ADD COLUMN fetched_at TEXT"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE gps_readings ADD COLUMN location_name TEXT"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE gps_readings ADD COLUMN location_district TEXT"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE gps_readings RENAME COLUMN location_province TO location_district"); } catch (_) {}

  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN device_id TEXT"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN river_name TEXT"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN station_name TEXT"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN distance_km REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN alert_level REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN minor_flood_level REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN major_flood_level REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN rainfall REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN gauge_latitude REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN gauge_longitude REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE water_level_readings ADD COLUMN updated_at TEXT"); } catch (_) {}

  // ── Hydrospatial data extensions ──
  try { disasterDb.exec("ALTER TABLE hydrospatial_data ADD COLUMN gauge_elevation REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE hydrospatial_data ADD COLUMN elevation_difference REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE hydrospatial_data ADD COLUMN gauge_distance REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE hydrospatial_data ADD COLUMN gauge_latitude REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE hydrospatial_data ADD COLUMN gauge_longitude REAL"); } catch (_) {}
  try { disasterDb.exec("ALTER TABLE hydrospatial_data ADD COLUMN station_name TEXT"); } catch (_) {}

  logger.info(`[DISASTER DB] Connected: ${C.DISASTER_DB_PATH}`);
} catch (err) {
  logger.error(`[DISASTER DB] Initialisation failed: ${err.message}`);
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════════════
// PostgreSQL — cloud sync pool
// ═════════════════════════════════════════════════════════════════════════════

let pgPool;
if (C.AWS_RDS_HOST) {
  pgPool = new Pool({
    host: C.AWS_RDS_HOST,
    port: C.AWS_RDS_PORT,
    database: C.AWS_RDS_DB,
    user: C.AWS_RDS_USER,
    password: C.AWS_RDS_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: C.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  pgPool.on('error', (err) => {
    logger.warn(`[PG] Pool error (offline?): ${err.message}`);
  });
} else {
  pgPool = null;
  logger.info('[PG] No AWS_RDS_HOST configured — PostgreSQL disabled');
}

// ═════════════════════════════════════════════════════════════════════════════
// SQLite Helper Functions
// ═════════════════════════════════════════════════════════════════════════════

export function sqliteInsert(table, data) {
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data);
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  try {
    const stmt = pagesDb.prepare(sql);
    const result = stmt.run(...values);
    return { success: true, changes: result.changes };
  } catch (err) {
    logger.error(`[SQLite] Insert into ${table} failed: ${err.message}`);
    throw err;
  }
}

export function sqliteUpdate(table, data, whereClause, whereParams = []) {
  const setClause = Object.keys(data).map(col => `${col} = ?`).join(', ');
  const values = Object.values(data);
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  try {
    const stmt = pagesDb.prepare(sql);
    const result = stmt.run(...values, ...whereParams);
    return { success: true, changes: result.changes };
  } catch (err) {
    logger.error(`[SQLite] Update ${table} failed: ${err.message}`);
    throw err;
  }
}

export function sqliteRetrieve(table, columns = null, whereClause = '1=1', whereParams = []) {
  let columnSql = '*';
  if (columns !== undefined && columns !== null && columns !== '') {
    columnSql = Array.isArray(columns) ? (columns.length ? columns.join(', ') : '*')
      : (typeof columns === 'string' && columns.trim().length ? columns : '*');
  }
  const sql = `SELECT ${columnSql} FROM ${table} WHERE ${whereClause}`;
  try {
    return pagesDb.prepare(sql).all(...whereParams);
  } catch (err) {
    logger.error(`[SQLite] Retrieve from ${table} failed: ${err.message}`);
    throw err;
  }
}

export function sqliteGetLastChildId() {
  try {
    const result = pagesDb.prepare('SELECT child_id FROM pages_children ORDER BY child_id DESC LIMIT 1').get();
    return result?.child_id || null;
  } catch (err) {
    logger.error(`[SQLite] Get last child_id failed: ${err.message}`);
    throw err;
  }
}

export function sqliteCheckResId(resId) {
  try {
    const result = pagesDb.prepare('SELECT 1 FROM pages_children WHERE res_id LIKE ? LIMIT 1').get(resId);
    return !!result;
  } catch (err) {
    logger.error(`[SQLite] Check res_id failed: ${err.message}`);
    return false;
  }
}

export { campDb, pagesDb, disasterDb, pgPool, initializeCampDb };
