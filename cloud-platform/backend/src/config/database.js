/**
 * PostgreSQL connection — shared Pool for the whole backend.
 *
 * The pool is only built when the db is enabled (env.db.enabled) so the
 * in-memory repository path keeps working without a database. Repositories
 * import the pool lazily through initDatabase().
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

let pool = null;

/** Builds (once) and returns the shared pg Pool. */
export function getPool() {
  if (pool) return pool;

  const { db } = env;
  const config = db.connectionString
    ? { connectionString: db.connectionString }
    : { host: db.host, port: db.port, database: db.name, user: db.user, password: db.password };

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
