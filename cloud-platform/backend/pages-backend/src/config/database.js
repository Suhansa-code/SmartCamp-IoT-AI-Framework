'use strict';

const path      = require('path');
const fs        = require('fs');
const Database  = require('better-sqlite3');
const { Pool }  = require('pg');
const logger    = require('../utils/logger');
const C         = require('./constants');

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

module.exports = { db, pgPool, pgIsReachable, pgQuery };