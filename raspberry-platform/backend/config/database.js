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
  `);

  try { campDb.exec("ALTER TABLE persons ADD COLUMN person_type TEXT DEFAULT 'refugee'"); } catch (_) {}
  campDb.exec('CREATE INDEX IF NOT EXISTS idx_persons_type ON persons(person_type)');
  try { campDb.exec('ALTER TABLE persons ADD COLUMN mqtt_client_id TEXT'); } catch (_) {}
  try { campDb.exec('ALTER TABLE persons ADD COLUMN mqtt_password TEXT'); } catch (_) {}
  try { campDb.exec('ALTER TABLE persons ADD COLUMN is_active INTEGER DEFAULT 1'); } catch (_) {}
  campDb.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_mqtt_client_id
      ON persons(mqtt_client_id) WHERE mqtt_client_id IS NOT NULL
  `);

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
// PostgreSQL — cloud sync pool
// ═════════════════════════════════════════════════════════════════════════════

const pgPool = new Pool({
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

export async function pgIsReachable() {
  if (!C.AWS_RDS_HOST) return false;
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch { return false; }
}

export async function pgQuery(text, params = []) {
  const client = await pgPool.connect();
  try {
    return await client.query(text, params);
  } finally { client.release(); }
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

export { campDb, pagesDb, pgPool, initializeCampDb };
