'use strict';

const path      = require('path');
const fs        = require('fs');
const Database  = require('better-sqlite3');
const { createClient } = require('@libsql/client');
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

// ── Turso/libSQL — cloud sync client ─────────────────────────────────────────

const tursoClient = C.TURSO_URL
  ? createClient({
      url: C.TURSO_URL,
      authToken: C.TURSO_AUTH_TOKEN,
    })
  : null;

if (tursoClient) {
  logger.info(`[DB] Turso configured: ${C.TURSO_URL}`);
} else {
  logger.warn('[DB] TURSO_URL not set — cloud sync disabled');
}

/**
 * Convert PostgreSQL-style placeholders ($1, $2, ...) to libSQL placeholders (?).
 * Keeps existing pgQuery callers compatible without changing their SQL.
 *
 * @param {string} text
 * @param {Array} params
 * @returns {{ sql: string, args: Array }}
 */
function toLibsqlQuery(text, params = []) {
  const args = [];
  const sql = text.replace(/\$(\d+)/g, (_, index) => {
    const i = Number(index) - 1;
    args.push(params[i]);
    return '?';
  });

  return { sql, args };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Test whether Turso is reachable.
 * Used by connectivity service.
 * @returns {Promise<boolean>}
 */
async function pgIsReachable() {
  if (!tursoClient) return false;
  try {
    await tursoClient.execute('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a query on Turso/libSQL.
 * Throws if unavailable — caller must catch.
 * @param {string} text
 * @param {Array}  params
 */
async function pgQuery(text, params = []) {
  if (!tursoClient) {
    throw new Error('Turso client is not configured. Set TURSO_URL and TURSO_AUTH_TOKEN.');
  }

  const { sql, args } = toLibsqlQuery(text, params);
  const result = await tursoClient.execute({ sql, args });
  return result;
}

module.exports = { db, pgPool: null, pgIsReachable, pgQuery, tursoClient };