import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from './env.js';

const dbPath = env.alerts.dbPath;
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Initialize database connection
export const db = new Database(dbPath, { fileMustExist: false });

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema.
 * Creates tables if they don't exist. Idempotent — safe to call on every boot.
 */
export function initializeSchema() {
  try {
    db.exec(`
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(child_id) REFERENCES pages_children(child_id)
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pages_sessions (
        session_id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL,
        composite_score REAL,
        anomaly_flagged INTEGER DEFAULT 0,
        alert_triggered INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(child_id) REFERENCES pages_children(child_id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_child ON pages_sessions(child_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_created ON pages_sessions(created_at DESC);
    `);
  } catch (err) {
    console.error('[DB] Failed to initialize schema:', err.message);
    throw err;
  }
}

/**
 * Close the database connection (used during shutdown / in tests).
 */
export function closeDatabase() {
  if (db.open) db.close();
}
