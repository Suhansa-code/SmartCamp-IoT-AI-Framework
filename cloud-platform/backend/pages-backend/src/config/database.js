'use strict';

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import logger from '../utils/logger.js';
import C from './constants.js';

function migrateSelectedAnswerConstraint(db) {
  const row = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'pages_content_responses'
  `).get();

  if (!row?.sql) return;

  const hasLegacyConstraint = row.sql.includes("selected_answer IN ('a', 'b', 'c')");
  if (!hasLegacyConstraint) return;

  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE pages_content_responses RENAME TO pages_content_responses_legacy;

      CREATE TABLE pages_content_responses (
        response_id       TEXT PRIMARY KEY,
        session_id        TEXT NOT NULL REFERENCES pages_sessions(session_id),
        child_id          TEXT NOT NULL REFERENCES pages_children(child_id),
        task_id           TEXT NOT NULL,
        selected_answer   TEXT NOT NULL,
        is_correct        INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
        time_taken_ms     INTEGER NOT NULL,
        responded_at      TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
        synced            INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO pages_content_responses (
        response_id,
        session_id,
        child_id,
        task_id,
        selected_answer,
        is_correct,
        time_taken_ms,
        responded_at,
        synced
      )
      SELECT
        response_id,
        session_id,
        child_id,
        task_id,
        selected_answer,
        is_correct,
        time_taken_ms,
        responded_at,
        synced
      FROM pages_content_responses_legacy;

      DROP TABLE pages_content_responses_legacy;

      CREATE INDEX IF NOT EXISTS idx_responses_session ON pages_content_responses(session_id);
      CREATE INDEX IF NOT EXISTS idx_responses_synced  ON pages_content_responses(synced);
    `);
  });

  migrate();
  logger.info('[DB] Migrated pages_content_responses selected_answer constraint');
}

function migrateAddQRCodeColumn(db) {
  const row = db.prepare(`
    PRAGMA table_info(pages_children)
  `).all();

  const hasQRColumn = row.some(col => col.name === 'qr_code_data');
  if (hasQRColumn) return;

  try {
    db.exec(`
      ALTER TABLE pages_children ADD COLUMN qr_code_data TEXT;
    `);
    logger.info('[DB] Added qr_code_data column to pages_children');
  } catch (err) {
    logger.warn(`[DB] Could not add qr_code_data column: ${err.message}`);
  }
}

// SQLite — initialise and apply schema 

// Ensure the database directory exists
const dbDir = path.dirname(path.resolve(C.SQLITE_PATH));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure models directory exists for IF .pkl files
const modelsDir = path.resolve(C.MODELS_DIR);
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

let db;
try {
  db = new Database(path.resolve(C.SQLITE_PATH), {
    // verbose: C.NODE_ENV === 'development' ? console.log : null,
    timeout: 5000,
  });

  // Apply WAL mode and FK enforcement immediately
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  // Apply schema
  const schemaPath = path.resolve('./database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    migrateSelectedAnswerConstraint(db);
    migrateAddQRCodeColumn(db);
    logger.info('[DB] SQLite schema applied successfully');
  } else {
    logger.warn('[DB] schema.sql not found — tables may not exist');
  }

  logger.info(`[DB] SQLite connected: ${C.SQLITE_PATH}`);
} catch (err) {
  logger.error(`[DB] SQLite initialisation failed: ${err.message}`);
  process.exit(1);
}

// PostgreSQL — lazy pool 
// The pool is created once but connections only attempted when actually used.
// If RDS is unreachable, pg will log errors but not crash the process.

const pgPool = new Pool({
  host:               C.AWS_RDS_HOST,
  port:               C.AWS_RDS_PORT,
  database:           C.AWS_RDS_DB,
  user:               C.AWS_RDS_USER,
  password:           C.AWS_RDS_PASSWORD,
  max:                5,             // small pool — RPi has limited connections
  idleTimeoutMillis:  30000,
  connectionTimeoutMillis: 5000,
  ssl: C.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pgPool.on('error', (err) => {
  logger.warn(`[DB] PostgreSQL pool error (offline?): ${err.message}`);
});

// Helpers 

/**
 * Test whether PostgreSQL is reachable.
 * Used by connectivity service.
 * @returns {Promise<boolean>}
 */
async function pgIsReachable() {
  if (!C.AWS_RDS_HOST) return false;
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a query on PostgreSQL.
 * Throws if unavailable — caller must catch.
 * @param {string} text
 * @param {Array}  params
 */
async function pgQuery(text, params = []) {
  const client = await pgPool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SQLite Helper Functions (Turso Replacement)
// These provide sync wrappers around better-sqlite3 for use in controllers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Insert a record into SQLite table
 * @param {string} table - Table name
 * @param {Object} data - Column: value pairs
 * @returns {Object} Result from better-sqlite3
 */
function sqliteInsert(table, data) {
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data);
  
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...values);
    logger.info(`[SQLite] Inserted into ${table}: ${JSON.stringify(data)}`);
    return { success: true, changes: result.changes };
  } catch (err) {
    logger.error(`[SQLite] Insert into ${table} failed: ${err.message}`);
    throw err;
  }
}

/**
 * Update records in SQLite table
 * @param {string} table - Table name
 * @param {Object} data - Column: value pairs to update
 * @param {string} whereClause - WHERE condition (e.g., 'id = ?')
 * @param {Array} whereParams - Parameters for WHERE clause
 * @returns {Object} Result from better-sqlite3
 */
function sqliteUpdate(table, data, whereClause, whereParams = []) {
  const setClause = Object.keys(data).map(col => `${col} = ?`).join(', ');
  const values = Object.values(data);
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...values, ...whereParams);
    logger.info(`[SQLite] Updated ${table}: ${JSON.stringify(data)} where ${whereClause}`);
    return { success: true, changes: result.changes };
  } catch (err) {
    logger.error(`[SQLite] Update ${table} failed: ${err.message}`);
    throw err;
  }
}

/**
 * Retrieve records from SQLite table
 * @param {string} table - Table name
 * @param {string|Array|null} columns - Columns to select (default: *)
 * @param {string} whereClause - WHERE condition
 * @param {Array} whereParams - Parameters for WHERE clause
 * @returns {Array} Array of rows
 */
function sqliteRetrieve(table, columns = null, whereClause = '1=1', whereParams = []) {
  let columnSql = '*';
  
  if (columns !== undefined && columns !== null && columns !== '') {
    if (Array.isArray(columns)) {
      columnSql = columns.length ? columns.join(', ') : '*';
    } else if (typeof columns === 'string' && columns.trim().length) {
      columnSql = columns;
    }
  }
  
  const sql = `SELECT ${columnSql} FROM ${table} WHERE ${whereClause}`;
  
  try {
    const stmt = db.prepare(sql);
    const result = stmt.all(...whereParams);
    logger.info(`[SQLite] Retrieved from ${table}: columns=${columnSql} where ${whereClause}, found=${result.length}`);
    return result;
  } catch (err) {
    logger.error(`[SQLite] Retrieve from ${table} failed: ${err.message}`);
    throw err;
  }
}

/**
 * Retrieve all records from SQLite table with WHERE clause
 * @param {string} table - Table name
 * @param {string} whereClause - WHERE condition
 * @param {Array} whereParams - Parameters for WHERE clause
 * @returns {Array} Array of rows
 */
function sqliteRetrieveAll(table, whereClause = '1=1', whereParams = []) {
  const sql = `SELECT * FROM ${table} WHERE ${whereClause}`;
  
  try {
    const stmt = db.prepare(sql);
    const result = stmt.all(...whereParams);
    logger.info(`[SQLite] Retrieved all from ${table}: where ${whereClause}, found=${result.length}`);
    return result;
  } catch (err) {
    logger.error(`[SQLite] Retrieve all from ${table} failed: ${err.message}`);
    throw err;
  }
}

/**
 * Get the last/latest child ID from SQLite
 * @returns {string|null} Latest child_id or null if none exists
 */
function sqliteGetLastChildId() {
  try {
    const result = db.prepare(`
      SELECT child_id FROM pages_children ORDER BY child_id DESC LIMIT 1
    `).get();
    logger.info(`[SQLite] Retrieved last child_id: ${result?.child_id || 'none'}`);
    return result?.child_id || null;
  } catch (err) {
    logger.error(`[SQLite] Get last child_id failed: ${err.message}`);
    throw err;
  }
}

/**
 * Check if a resource ID exists in the database
 * @param {string} resId - Resource ID to check
 * @returns {boolean} True if exists, false otherwise
 */
function sqliteCheckResId(resId) {
  try {
    const result = db.prepare(`
      SELECT 1 FROM pages_children WHERE res_id LIKE ? LIMIT 1
    `).get(resId);
    const exists = !!result;
    logger.info(`[SQLite] Checked res_id '${resId}': exists=${exists}`);
    return exists;
  } catch (err) {
    logger.error(`[SQLite] Check res_id failed: ${err.message}`);
    return false;
  }
}

export { db, pgPool, pgIsReachable, pgQuery, sqliteInsert, sqliteUpdate, sqliteRetrieve, sqliteRetrieveAll, sqliteGetLastChildId, sqliteCheckResId };
