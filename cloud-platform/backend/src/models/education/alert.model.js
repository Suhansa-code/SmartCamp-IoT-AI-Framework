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

/**
 * Per-camp education summaries for the Education Insights view.
 * Aggregates the synced children / sessions / alerts that the
 * raspberry-platform PAGES module pushed to the cloud DB.
 */
export function getCampSummaries() {
  const rows = db
    .prepare(`
      SELECT
        c.camp_id,
        COUNT(DISTINCT c.child_id) AS children_count,
        (SELECT COUNT(*) FROM pages_sessions s
          WHERE s.child_id IN (SELECT child_id FROM pages_children WHERE camp_id = c.camp_id)) AS sessions_count,
        (SELECT ROUND(AVG(composite_score), 1) FROM pages_sessions s
          WHERE s.child_id IN (SELECT child_id FROM pages_children WHERE camp_id = c.camp_id)
            AND composite_score IS NOT NULL) AS avg_composite,
        (SELECT COUNT(*) FROM pages_sessions s
          WHERE s.child_id IN (SELECT child_id FROM pages_children WHERE camp_id = c.camp_id)
            AND anomaly_flagged = 1) AS flagged_sessions,
        (SELECT COUNT(*) FROM pages_alerts a WHERE a.camp_id = c.camp_id) AS total_alerts,
        (SELECT COUNT(*) FROM pages_alerts a WHERE a.camp_id = c.camp_id AND a.status = 'pending') AS pending_alerts,
        (SELECT MAX(s.created_at) FROM pages_sessions s
          WHERE s.child_id IN (SELECT child_id FROM pages_children WHERE camp_id = c.camp_id)) AS last_session_at
      FROM pages_children c
      GROUP BY c.camp_id
      ORDER BY c.camp_id
    `)
    .all();

  const gradeDist = db
    .prepare(`
      SELECT camp_id, grade, COUNT(*) AS c
      FROM pages_children
      GROUP BY camp_id, grade
    `)
    .all();

  return rows.map((row) => ({
    id: row.camp_id,
    children: row.children_count,
    sessions: row.sessions_count,
    avg_composite: row.avg_composite === null ? null : Number(row.avg_composite),
    flagged_sessions: row.flagged_sessions || 0,
    total_alerts: row.total_alerts || 0,
    pending_alerts: row.pending_alerts || 0,
    grade_distribution: gradeDist
      .filter((g) => g.camp_id === row.camp_id)
      .map((g) => ({ grade: g.grade, count: g.c })),
    last_session_at: row.last_session_at || null,
  }));
}

/**
 * Full education detail for one camp: children, sessions, alerts and
 * aggregates. Returns null when the camp has no synced children.
 */
export function getCampEducation(campId) {
  const children = db
    .prepare(`
      SELECT child_id, res_id, camp_id, grade, language, baseline_score, total_sessions, alert_status
      FROM pages_children
      WHERE camp_id = ?
      ORDER BY child_id
    `)
    .all(campId);

  if (children.length === 0) return null;

  const sessions = db
    .prepare(`
      SELECT
        s.session_id, s.child_id, s.composite_score,
        s.anomaly_flagged, s.alert_triggered, s.created_at,
        c.grade, c.language, c.baseline_score
      FROM pages_sessions s
      LEFT JOIN pages_children c ON c.child_id = s.child_id
      WHERE s.child_id IN (SELECT child_id FROM pages_children WHERE camp_id = ?)
      ORDER BY s.created_at DESC
    `)
    .all(campId);

  const alerts = db
    .prepare(`
      SELECT alert_id, child_id, res_id, camp_id, alert_type, trigger_detail,
             triggered_at, status, resolved_at, resolved_notes
      FROM pages_alerts
      WHERE camp_id = ?
      ORDER BY triggered_at DESC
    `)
    .all(campId);

  const recentByChild = {};
  const perChildStmt = db.prepare(`
    SELECT composite_score, created_at
    FROM pages_sessions
    WHERE child_id = ? AND composite_score IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 8
  `);
  for (const child of children) {
    recentByChild[child.child_id] = perChildStmt
      .all(child.child_id)
      .map((s) => ({ score: Math.round(s.composite_score), date: s.created_at }))
      .reverse();
  }

  const scored = sessions.filter(
    (s) => s.composite_score !== null && s.composite_score !== undefined,
  );
  const avgComposite = scored.length
    ? Math.round((scored.reduce((sum, s) => sum + s.composite_score, 0) / scored.length) * 10) / 10
    : null;

  const gradeDist = {};
  const langDist = {};
  for (const child of children) {
    gradeDist[child.grade] = (gradeDist[child.grade] || 0) + 1;
    langDist[child.language] = (langDist[child.language] || 0) + 1;
  }

  return {
    id: campId,
    children_count: children.length,
    sessions_count: sessions.length,
    flagged_sessions: scored.filter((s) => s.anomaly_flagged === 1).length,
    avg_composite: avgComposite,
    pending_alerts: alerts.filter((a) => a.status === 'pending').length,
    total_alerts: alerts.length,
    grade_distribution: Object.entries(gradeDist).map(([grade, count]) => ({
      grade: Number(grade),
      count,
    })),
    language_distribution: Object.entries(langDist).map(([language, count]) => ({
      language,
      count,
    })),
    children: children.map((child) => ({
      ...child,
      recent_scores: recentByChild[child.child_id] || [],
    })),
    sessions: sessions.map((s) => ({ ...s })),
    alerts: alerts.map((a) => ({
      ...a,
      trigger_detail: a.trigger_detail ? JSON.parse(a.trigger_detail) : null,
    })),
  };
}
