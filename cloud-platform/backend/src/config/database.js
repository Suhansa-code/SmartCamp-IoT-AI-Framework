/**
 * PostgreSQL connection — shared Pool for the whole backend.
 *
 * The pool is only built when the db is enabled (env.db.enabled) so the
 * in-memory repository path keeps working without a database. Repositories
 * import the pool lazily through initDatabase().
 */
import pg from 'pg';
import net from 'net';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

let pool = null;

/**
 * Widens Node's happy-eyeballs per-address handshake budget.
 *
 * When a hostname resolves to several addresses, Node races them and allows
 * each one only 250ms to finish its TCP handshake before moving on. Neon
 * publishes several A and AAAA records, so from a link whose round trip to the
 * region exceeds that budget EVERY attempt is abandoned and pg surfaces an
 * AggregateError of `connect ETIMEDOUT` — one per address. That reads exactly
 * like a blocked port, which it is not: `nc <host> 5432` connects fine at the
 * same moment. It bites on a distant workstation and not in the deployment
 * region, so it looks like a credentials problem on a developer's machine only.
 *
 * Must run before the first connection; the setting is process-wide.
 */
function widenAddressAttemptTimeout(ms) {
  if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout !== 'function') return;
  net.setDefaultAutoSelectFamilyAttemptTimeout(ms);
}

/** Builds (once) and returns the shared pg Pool. */
export function getPool() {
  if (pool) return pool;

  const { db } = env;

  widenAddressAttemptTimeout(db.connectAttemptTimeoutMs);

  const config = db.connectionString
    ? { connectionString: db.connectionString }
    : { host: db.host, port: db.port, database: db.name, user: db.user, password: db.password };

  config.connectionTimeoutMillis = db.connectionTimeoutMs;
  config.query_timeout = 10000;
  config.statement_timeout = 10000;
  config.max = 20;
  config.idleTimeoutMillis = 30000;

  if (db.ssl) config.ssl = { rejectUnauthorized: false };

  pool = new Pool(config);
  return pool;
}

/** Verifies the connection with a trivial query. */
export async function testConnection() {
  const result = await getPool().query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

/** Runs the schema DDL (idempotent — CREATE IF NOT EXISTS). */
export async function initSchema() {
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');
  await getPool().query(schema);
}

/** Closes the shared pool (used on shutdown). */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
