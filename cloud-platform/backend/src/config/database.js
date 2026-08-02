import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/alerts.db');

// Initialize database connection
const db = new Database(dbPath, { 
  verbose: console.log,
  fileMustExist: false 
});

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema
 * Creates tables if they don't exist
 */
function initializeSchema() {
  try {
    // Create pages_alerts table (synced from raspberry platform)
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

      -- Create pages_children table (simplified, synced from raspberry platform)
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

      -- Create pages_sessions table (for context/trend data)
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

    console.log('[DB] ✅ Schema initialized successfully');
  } catch (err) {
    console.error('[DB] ❌ Failed to initialize schema:', err.message);
    throw err;
  }
}

/**
 * Get all alerts with optional filtering
 * @param {string} [status] - 'pending' | 'resolved'
 * @param {string} [campId] - filter by camp
 * @returns {Array<Object>}
 */
function getAlerts(status = null, campId = null) {
  let query = `
    SELECT 
      a.alert_id,
      a.child_id,
      a.res_id,
      a.camp_id,
      a.alert_type,
      a.trigger_detail,
      a.triggered_at,
      a.status,
      a.resolved_at,
      a.resolved_notes,
      c.grade,
      c.language,
      c.baseline_score
    FROM pages_alerts a
    LEFT JOIN pages_children c ON a.child_id = c.child_id
    WHERE 1=1
  `;

  const params = [];

  if (status) {
    query += ` AND a.status = ?`;
    params.push(status);
  }

  if (campId && campId !== 'all') {
    query += ` AND a.camp_id = ?`;
    params.push(campId);
  }

  query += ` ORDER BY a.triggered_at DESC`;

  try {
    const alerts = db.prepare(query).all(...params);

    // Enhance each alert with recent session scores
    return alerts.map(alert => {
      const recentSessions = db.prepare(`
        SELECT composite_score
        FROM pages_sessions
        WHERE child_id = ? AND composite_score IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
      `).all(alert.child_id);

      const recentScores = recentSessions
        .map(s => s.composite_score !== null ? Math.round(s.composite_score) : null)
        .filter(s => s !== null)
        .reverse();

      return {
        ...alert,
        recent_scores: recentScores,
        trigger_detail: alert.trigger_detail ? JSON.parse(alert.trigger_detail) : null
      };
    });
  } catch (err) {
    console.error('[DB] Failed to get alerts:', err.message);
    throw err;
  }
}

/**
 * Get a single alert by ID
 * @param {string} alertId
 * @returns {Object|null}
 */
function getAlert(alertId) {
  try {
    const alert = db.prepare(`
      SELECT a.*, c.grade, c.language, c.baseline_score
      FROM pages_alerts a
      LEFT JOIN pages_children c ON a.child_id = c.child_id
      WHERE a.alert_id = ?
    `).get(alertId);

    if (alert && alert.trigger_detail) {
      alert.trigger_detail = JSON.parse(alert.trigger_detail);
    }

    return alert || null;
  } catch (err) {
    console.error('[DB] Failed to get alert:', err.message);
    throw err;
  }
}

/**
 * Create or update alert (synced from raspberry platform)
 * @param {Object} alertData
 * @returns {Object}
 */
function upsertAlert(alertData) {
  const {
    alert_id,
    child_id,
    res_id,
    camp_id,
    alert_type,
    trigger_detail,
    triggered_at
  } = alertData;

  try {
    db.prepare(`
      INSERT INTO pages_alerts 
        (alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      ON CONFLICT(alert_id) DO UPDATE SET
        status = 'pending',
        trigger_detail = excluded.trigger_detail
    `).run(
      alert_id,
      child_id,
      res_id,
      camp_id,
      alert_type,
      typeof trigger_detail === 'string' ? trigger_detail : JSON.stringify(trigger_detail),
      triggered_at
    );

    console.log(`[DB] ✅ Upserted alert ${alert_id}`);
    return { success: true, alert_id };
  } catch (err) {
    console.error('[DB] Failed to upsert alert:', err.message);
    throw err;
  }
}

/**
 * Resolve an alert (admin action)
 * @param {string} alertId
 * @param {string} notes
 * @returns {boolean}
 */
function resolveAlert(alertId, notes = null) {
  try {
    const result = db.prepare(`
      UPDATE pages_alerts
      SET status = 'resolved', resolved_at = datetime('now'), resolved_notes = ?
      WHERE alert_id = ?
    `).run(notes, alertId);

    if (result.changes > 0) {
      console.log(`[DB] ✅ Resolved alert ${alertId}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[DB] Failed to resolve alert:', err.message);
    throw err;
  }
}

/**
 * Sync child data from raspberry platform
 * @param {Array<Object>} children
 */
function syncChildren(children) {
  try {
    const stmt = db.prepare(`
      INSERT INTO pages_children (child_id, res_id, camp_id, grade, language, baseline_score)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(child_id) DO UPDATE SET
        grade = excluded.grade,
        language = excluded.language,
        baseline_score = excluded.baseline_score
    `);

    const insertMany = db.transaction((items) => {
      for (const child of items) {
        stmt.run(
          child.child_id,
          child.res_id,
          child.camp_id,
          child.grade,
          child.language,
          child.baseline_score
        );
      }
    });

    insertMany(children);
    console.log(`[DB] ✅ Synced ${children.length} children`);
  } catch (err) {
    console.error('[DB] Failed to sync children:', err.message);
    throw err;
  }
}

/**
 * Sync session data from raspberry platform
 * @param {Array<Object>} sessions
 */
function syncSessions(sessions) {
  try {
    const stmt = db.prepare(`
      INSERT INTO pages_sessions (session_id, child_id, composite_score, anomaly_flagged, alert_triggered, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        composite_score = excluded.composite_score,
        anomaly_flagged = excluded.anomaly_flagged,
        alert_triggered = excluded.alert_triggered
    `);

    const insertMany = db.transaction((items) => {
      for (const session of items) {
        stmt.run(
          session.session_id,
          session.child_id,
          session.composite_score,
          session.anomaly_flagged ? 1 : 0,
          session.alert_triggered ? 1 : 0,
          session.created_at
        );
      }
    });

    insertMany(sessions);
    console.log(`[DB] ✅ Synced ${sessions.length} sessions`);
  } catch (err) {
    console.error('[DB] Failed to sync sessions:', err.message);
    throw err;
  }
}

// Initialize schema on import
initializeSchema();

export {
  db,
  getAlerts,
  getAlert,
  upsertAlert,
  resolveAlert,
  syncChildren,
  syncSessions
};
