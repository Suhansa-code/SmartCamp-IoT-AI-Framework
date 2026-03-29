'use strict';

const path      = require('path');
const fs        = require('fs');
const Database  = require('better-sqlite3');
const { Pool }  = require('pg');
const logger    = require('../utils/logger');
const C         = require('./constants');

// ── SQLite — initialise and apply schema ──────────────────────────────────────

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
    logger.info('[DB] SQLite schema applied successfully');
  } else {
    logger.warn('[DB] schema.sql not found — tables may not exist');
  }

  logger.info(`[DB] SQLite connected: ${C.SQLITE_PATH}`);
} catch (err) {
  logger.error(`[DB] SQLite initialisation failed: ${err.message}`);
  process.exit(1);
}

// ── PostgreSQL — lazy pool ────────────────────────────────────────────────────
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
  // Do not crash — log and continue. SQLite keeps the app running.
  logger.warn(`[DB] PostgreSQL pool error (offline?): ${err.message}`);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

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