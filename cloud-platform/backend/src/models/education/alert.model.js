/**
 * Data-access layer for the Education domain (PAGES alerts).
 * All SQL lives here — controllers/services never touch SQL directly.
 */
import { db } from '../../config/database.js';

export function getAlerts(status = null, campId = null) {
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

  const alerts = db.prepare(query).all(...params);

  return alerts.map((alert) => {
    const recentSessions = db
      .prepare(`
        SELECT composite_score
        FROM pages_sessions
        WHERE child_id = ? AND composite_score IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
      `)
      .all(alert.child_id);

    const recentScores = recentSessions
      .map((s) => (s.composite_score !== null ? Math.round(s.composite_score) : null))
      .filter((s) => s !== null)
      .reverse();

    return {
      ...alert,
      recent_scores: recentScores,
      trigger_detail: alert.trigger_detail ? JSON.parse(alert.trigger_detail) : null,
    };
  });
}

export function getAlert(alertId) {
  const alert = db
    .prepare(`
      SELECT a.*, c.grade, c.language, c.baseline_score
      FROM pages_alerts a
      LEFT JOIN pages_children c ON a.child_id = c.child_id
      WHERE a.alert_id = ?
    `)
    .get(alertId);

  if (alert && alert.trigger_detail) {
    alert.trigger_detail = JSON.parse(alert.trigger_detail);
  }

  return alert || null;
}

export function upsertAlert(alertData) {
  const { alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at } = alertData;

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
    triggered_at,
  );

  return { success: true, alert_id };
}

export function resolveAlert(alertId, notes = null) {
  const result = db
    .prepare(`
      UPDATE pages_alerts
      SET status = 'resolved', resolved_at = datetime('now'), resolved_notes = ?
      WHERE alert_id = ?
    `)
    .run(notes, alertId);

  return result.changes > 0;
}

export function syncChildren(children) {
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
      stmt.run(child.child_id, child.res_id, child.camp_id, child.grade, child.language, child.baseline_score);
    }
  });

  insertMany(children);
  return children.length;
}

export function syncSessions(sessions) {
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
        session.created_at,
      );
    }
  });

  insertMany(sessions);
  return sessions.length;
}
