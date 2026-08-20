/**
 * Education domain repository — PostgreSQL implementation.
 *
 * Mirrors the exact function/field contract of the in-memory repository
 * (repositories/education/alert.memory.repository.js) so controllers and
 * services never change when switching between them. All functions return
 * promises.
 */
import { getPool } from '../../config/database.js';

const ALERT_SELECT = `
  SELECT a.*, c.grade, c.language, c.baseline_score
  FROM alerts a
  LEFT JOIN children c ON c.child_id = a.child_id
`;

function parseTriggerDetail(triggerDetail) {
  if (!triggerDetail) return null;
  if (typeof triggerDetail === 'string') {
    try {
      return JSON.parse(triggerDetail);
    } catch {
      return triggerDetail;
    }
  }
  return triggerDetail;
}

/** Recent rounded scores for one child (oldest → newest), up to `limit`. */
async function recentScoresFor(childId, limit = 5) {
  const result = await getPool().query(
    `SELECT composite_score
       FROM sessions
      WHERE child_id = $1 AND composite_score IS NOT NULL
      ORDER BY created_at DESC
      LIMIT $2`,
    [childId, limit],
  );
  return result.rows.map((r) => Math.round(r.composite_score)).reverse();
}

export async function getAlerts(status = null, campId = null) {
  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (campId && campId !== 'all') {
    params.push(campId);
    conditions.push(`a.camp_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await getPool().query(
    `${ALERT_SELECT} ${where} ORDER BY a.triggered_at DESC`,
    params,
  );

  return Promise.all(
    result.rows.map(async (row) => ({
      ...row,
      trigger_detail: parseTriggerDetail(row.trigger_detail),
      recent_scores: await recentScoresFor(row.child_id, 5),
    })),
  );
}

export async function getAlert(alertId) {
  const result = await getPool().query(`${ALERT_SELECT} WHERE a.alert_id = $1`, [alertId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    ...row,
    trigger_detail: parseTriggerDetail(row.trigger_detail),
  };
}

export async function upsertAlert(alertData) {
  const { alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at } = alertData;

  await getPool().query(
    `INSERT INTO alerts (alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at, status, resolved_at, resolved_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NULL, NULL)
     ON CONFLICT (alert_id) DO UPDATE SET
       child_id       = EXCLUDED.child_id,
       res_id         = EXCLUDED.res_id,
       camp_id        = EXCLUDED.camp_id,
       alert_type     = EXCLUDED.alert_type,
       trigger_detail = EXCLUDED.trigger_detail,
       triggered_at   = EXCLUDED.triggered_at,
       status         = 'pending',
       resolved_at    = NULL,
       resolved_notes = NULL`,
    [alert_id, child_id, res_id ?? null, camp_id, alert_type, JSON.stringify(trigger_detail ?? null), triggered_at],
  );

  return { success: true, alert_id };
}

export async function resolveAlert(alertId, notes = null) {
  const result = await getPool().query(
    `UPDATE alerts
        SET status = 'resolved', resolved_at = NOW(), resolved_notes = $2
      WHERE alert_id = $1`,
    [alertId, notes],
  );
  return result.rowCount > 0;
}

export async function syncChildren(children) {
  for (const child of children) {
    await getPool().query(
      `INSERT INTO children (child_id, res_id, camp_id, grade, language, baseline_score, total_sessions, alert_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (child_id) DO UPDATE SET
         res_id          = COALESCE(EXCLUDED.res_id, children.res_id),
         camp_id         = COALESCE(EXCLUDED.camp_id, children.camp_id),
         grade           = COALESCE(EXCLUDED.grade, children.grade),
         language        = COALESCE(EXCLUDED.language, children.language),
         baseline_score  = COALESCE(EXCLUDED.baseline_score, children.baseline_score),
         total_sessions  = COALESCE(EXCLUDED.total_sessions, children.total_sessions),
         alert_status    = COALESCE(EXCLUDED.alert_status, children.alert_status)`,
      [child.child_id, child.res_id ?? null, child.camp_id ?? null, child.grade ?? null, child.language ?? null, child.baseline_score ?? null, child.total_sessions ?? null, child.alert_status ?? null],
    );
  }
  return children.length;
}

export async function syncSessions(sessions) {
  for (const session of sessions) {
    await getPool().query(
      `INSERT INTO sessions (session_id, child_id, composite_score, anomaly_flagged, alert_triggered, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (session_id) DO UPDATE SET
         composite_score = COALESCE(EXCLUDED.composite_score, sessions.composite_score),
         anomaly_flagged = COALESCE(EXCLUDED.anomaly_flagged, sessions.anomaly_flagged),
         alert_triggered = COALESCE(EXCLUDED.alert_triggered, sessions.alert_triggered),
         created_at      = COALESCE(EXCLUDED.created_at, sessions.created_at)`,
      [session.session_id, session.child_id, session.composite_score ?? null, session.anomaly_flagged ? 1 : 0, session.alert_triggered ? 1 : 0, session.created_at ?? new Date().toISOString()],
    );
  }
  return sessions.length;
}

/**
 * Per-camp education summaries. Mirrors the SQL aggregation: children grouped
 * by camp, joined with sessions and alerts belonging to those children.
 */
export async function getCampSummaries() {
  const childrenResult = await getPool().query(`
    SELECT camp_id, child_id, grade
      FROM children
     ORDER BY camp_id
  `);
  const sessionsResult = await getPool().query(`
    SELECT s.*
      FROM sessions s
      JOIN children c ON c.child_id = s.child_id
     ORDER BY s.created_at DESC
  `);
  const alertsResult = await getPool().query(`
    SELECT *
      FROM alerts
     ORDER BY triggered_at DESC
  `);

  const childrenByCamp = new Map();
  for (const child of childrenResult.rows) {
    const list = childrenByCamp.get(child.camp_id) || [];
    list.push(child);
    childrenByCamp.set(child.camp_id, list);
  }

  const summaries = [];
  for (const [campId, campChildren] of [...childrenByCamp.entries()].sort((a, b) => (a[0] > b[0] ? 1 : -1))) {
    const childIds = new Set(campChildren.map((c) => c.child_id));
    const campSessions = sessionsResult.rows.filter((s) => childIds.has(s.child_id));
    const campAlerts = alertsResult.rows.filter((a) => a.camp_id === campId);

    const scored = campSessions.filter((s) => s.composite_score !== null && s.composite_score !== undefined);
    const avgComposite = scored.length
      ? Math.round((scored.reduce((sum, s) => sum + s.composite_score, 0) / scored.length) * 10) / 10
      : null;

    const gradeDist = {};
    for (const child of campChildren) {
      gradeDist[child.grade] = (gradeDist[child.grade] || 0) + 1;
    }

    summaries.push({
      id: campId,
      children: campChildren.length,
      sessions: campSessions.length,
      avg_composite: avgComposite === null ? null : Number(avgComposite),
      flagged_sessions: campSessions.filter((s) => s.anomaly_flagged === 1).length,
      total_alerts: campAlerts.length,
      pending_alerts: campAlerts.filter((a) => a.status === 'pending').length,
      grade_distribution: Object.entries(gradeDist).map(([grade, count]) => ({ grade, count })),
      last_session_at: campSessions.length
        ? campSessions.reduce((max, s) => (s.created_at > max ? s.created_at : max), campSessions[0].created_at)
        : null,
    });
  }

  return summaries;
}

/**
 * Full education detail for one camp. Returns null when the camp has no
 * synced children.
 */
export async function getCampEducation(campId) {
  const childrenResult = await getPool().query(
    `SELECT * FROM children WHERE camp_id = $1 ORDER BY child_id`,
    [campId],
  );

  if (childrenResult.rows.length === 0) return null;

  const childIds = childrenResult.rows.map((c) => c.child_id);
  const sessionsResult = await getPool().query(
    `SELECT * FROM sessions WHERE child_id = ANY($1) ORDER BY created_at DESC`,
    [childIds],
  );
  const alertsResult = await getPool().query(
    `SELECT * FROM alerts WHERE camp_id = $1 ORDER BY triggered_at DESC`,
    [campId],
  );

  const sessions = sessionsResult.rows;
  const alerts = alertsResult.rows;

  const sessionsForChild = (childId, limit = 8) =>
    sessions
      .filter((s) => s.child_id === childId && s.composite_score !== null && s.composite_score !== undefined)
      .slice(0, limit)
      .map((s) => ({ score: Math.round(s.composite_score), date: s.created_at }))
      .reverse();

  const recentByChild = {};
  for (const child of childrenResult.rows) {
    recentByChild[child.child_id] = sessionsForChild(child.child_id, 8);
  }

  const scored = sessions.filter((s) => s.composite_score !== null && s.composite_score !== undefined);
  const avgComposite = scored.length
    ? Math.round((scored.reduce((sum, s) => sum + s.composite_score, 0) / scored.length) * 10) / 10
    : null;

  const gradeDist = {};
  const langDist = {};
  for (const child of childrenResult.rows) {
    gradeDist[child.grade] = (gradeDist[child.grade] || 0) + 1;
    langDist[child.language] = (langDist[child.language] || 0) + 1;
  }

  return {
    id: campId,
    children_count: childrenResult.rows.length,
    sessions_count: sessions.length,
    flagged_sessions: scored.filter((s) => s.anomaly_flagged === 1).length,
    avg_composite: avgComposite,
    pending_alerts: alerts.filter((a) => a.status === 'pending').length,
    total_alerts: alerts.length,
    grade_distribution: Object.entries(gradeDist).map(([grade, count]) => ({ grade: Number(grade), count })),
    language_distribution: Object.entries(langDist).map(([language, count]) => ({ language, count })),
    children: childrenResult.rows.map((child) => ({
      ...child,
      recent_scores: recentByChild[child.child_id] || [],
    })),
    sessions: sessions.map((s) => ({ ...s })),
    alerts: alerts.map((a) => ({
      ...a,
      trigger_detail: parseTriggerDetail(a.trigger_detail),
    })),
  };
}
