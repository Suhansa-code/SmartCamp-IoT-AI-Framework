/**
 * sync-queue.js — Pending record discovery and sync state management.
 *
 * Uses the `synced` INTEGER column (0 = pending, 1 = done) that already exists
 * on every syncable table in both camp.db and pages.db.
 *
 * Each row gets _priority and _timestamp attached by classifyRowPriority(),
 * enabling priority-based processing order: CRITICAL → HIGH → MEDIUM → LOW,
 * oldest record first within each level.
 */
import { campDb, pagesDb } from '../../config/database.js';
import { classifyRowPriority, comparePriority } from './sync-priority.js';

const BATCH_SIZE = 50;

/**
 * Table → database mapping.
 */
const TABLE_DB = {
  // camp.db
  persons:                    campDb,
  camp_checkins:              campDb,
  wristbands:                 campDb,
  distributions:              campDb,
  resources:                  campDb,
  resource_usage:             campDb,
  audit_logs:                 campDb,
  // pages.db
  pages_children:             pagesDb,
  pages_sessions:             pagesDb,
  pages_behavioral_signals:   pagesDb,
  pages_gate_decisions:       pagesDb,
  pages_alerts:               pagesDb,
  pages_content_responses:    pagesDb,
};

/**
 * Primary key column per table — used for markSynced.
 */
const PK_MAP = {
  persons:                    'id',
  camp_checkins:              'id',
  wristbands:                 'id',
  distributions:              'id',
  resources:                  'id',
  resource_usage:             'id',
  audit_logs:                 'id',
  pages_children:             'child_id',
  pages_sessions:             'session_id',
  pages_behavioral_signals:   'signal_id',
  pages_gate_decisions:       'decision_id',
  pages_alerts:               'alert_id',
  pages_content_responses:    'response_id',
};

/**
 * Timestamp column per table — used for oldest-first ordering.
 * Falls back to 'created_at' if not listed.
 */
const TS_COLUMN = {
  persons:                    'created_at',
  camp_checkins:              'checkin_time',
  wristbands:                 'issued_at',
  distributions:              'distributed_at',
  resources:                  'created_at',
  resource_usage:             'created_at',
  audit_logs:                 'created_at',
  pages_children:             'enrolled_at',
  pages_sessions:             'created_at',
  pages_behavioral_signals:   'signal_id',
  pages_gate_decisions:       'decided_at',
  pages_alerts:               'triggered_at',
  pages_content_responses:    'responded_at',
};

function dbFor(table) {
  const db = TABLE_DB[table];
  if (!db) throw new Error(`[SYNC] Unknown table: ${table}`);
  return db;
}

/**
 * Attach _priority and _timestamp metadata to each row.
 * This is the core of row-level priority classification.
 */
function annotateRows(tableName, rows) {
  const tsCol = TS_COLUMN[tableName] || 'created_at';
  for (const row of rows) {
    const classified = classifyRowPriority(tableName, row);
    row._priority = classified.priority;
    row._reason = classified.reason;
    row._qos = classified.qos;
    row._timestamp = row[tsCol] || '';
  }
  return rows;
}

/**
 * Fetch pending (synced = 0) rows for a single table.
 * Rows are annotated with _priority and sorted by priority + age.
 *
 * @param {string} tableName
 * @param {number} limit
 * @returns {{ table: string, rows: object[] }}
 */
export function fetchPending(tableName, limit = BATCH_SIZE) {
  const db = dbFor(tableName);
  const tsCol = TS_COLUMN[tableName] || 'created_at';
  // Fetch oldest first at SQL level, then attach priority and re-sort
  const rows = db.prepare(
    `SELECT * FROM ${tableName} WHERE synced = 0 ORDER BY ${tsCol} ASC LIMIT ?`
  ).all(limit);

  annotateRows(tableName, rows);
  // Stable sort by priority then timestamp
  rows.sort(comparePriority);

  return { table: tableName, rows };
}

/**
 * Fetch pending rows for ALL syncable tables, sorted by priority+age globally.
 * Returns a flat array of { table, rows } objects (empty arrays excluded).
 */
export function fetchAllPending(limit = BATCH_SIZE) {
  const all = [];
  for (const tableName of Object.keys(TABLE_DB)) {
    const batch = fetchPending(tableName, limit);
    if (batch.rows.length > 0) all.push(batch);
  }
  // Sort table batches by the highest-priority row in each batch
  all.sort((a, b) => comparePriority(a.rows[0], b.rows[0]));
  return all;
}

/**
 * Count total pending rows across all tables.
 */
export function countPending() {
  const counts = {};
  let total = 0;
  for (const [table, db] of Object.entries(TABLE_DB)) {
    const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${table} WHERE synced = 0`).get();
    counts[table] = row.cnt;
    total += row.cnt;
  }
  return { total, counts };
}

/**
 * Mark a batch of rows as synced after successful MQTT publish.
 */
export function markSynced(tableName, primaryKey, ids) {
  if (!ids.length) return 0;
  const db = dbFor(tableName);
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(
    `UPDATE ${tableName} SET synced = 1 WHERE ${primaryKey} IN (${placeholders})`
  ).run(...ids);
  return result.changes;
}

/**
 * Mark all rows in a batch as synced using the appropriate primary key.
 */
export function markBatchSynced(tableName, rows) {
  if (!rows.length) return 0;
  const pk = PK_MAP[tableName] || 'id';
  const ids = rows.map(r => r[pk]).filter(Boolean);
  return markSynced(tableName, pk, ids);
}

/**
 * Returns the primary key column name for a given table.
 */
export function getPrimaryKey(tableName) {
  return PK_MAP[tableName] || 'id';
}

/**
 * Returns the list of all syncable table names.
 */
export function getSyncableTables() {
  return Object.keys(TABLE_DB);
}

export { TABLE_DB, PK_MAP, TS_COLUMN, BATCH_SIZE };
