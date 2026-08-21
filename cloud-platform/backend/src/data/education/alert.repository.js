/**
 * In-memory alert repository — provides the same interface as the PostgreSQL
 * repository but keeps all state in process memory. Used when DB_ENABLED=false
 * (default) and by tests that must not depend on a live database.
 */

const alerts = new Map();
const children = new Map();
const sessions = new Map();

export async function getAlerts(status = null, camp = null) {
  let result = Array.from(alerts.values());
  if (status) result = result.filter((a) => a.status === status);
  if (camp) result = result.filter((a) => a.camp_id === camp);
  return result;
}

export async function getAlert(alertId) {
  return alerts.get(alertId) || null;
}

export async function resolveAlert(alertId, notes = null) {
  const alert = alerts.get(alertId);
  if (!alert) return false;
  alert.status = 'resolved';
  alert.resolved_notes = notes;
  alert.resolved_at = new Date().toISOString();
  return true;
}

export async function upsertAlert({ alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at }) {
  if (!alert_id || !child_id || !camp_id) {
    return { success: false, alert_id: null, error: 'Missing required fields' };
  }

  alerts.set(alert_id, {
    alert_id,
    child_id,
    res_id: res_id || null,
    camp_id,
    alert_type: alert_type || 'unknown',
    trigger_detail: trigger_detail || {},
    triggered_at: triggered_at || new Date().toISOString(),
    status: 'pending',
    resolved_at: null,
    resolved_notes: null,
  });

  return { success: true, alert_id };
}

export async function syncChildren(childList) {
  let count = 0;
  for (const child of childList) {
    if (!child.child_id) continue;
    children.set(child.child_id, {
      child_id: child.child_id,
      res_id: child.res_id || null,
      camp_id: child.camp_id || null,
      grade: child.grade || null,
      language: child.language || null,
      baseline_score: child.baseline_score || null,
      total_sessions: child.total_sessions || 0,
      alert_status: child.alert_status || 'normal',
    });
    count++;
  }
  return count;
}

export async function syncSessions(sessionList) {
  let count = 0;
  for (const session of sessionList) {
    if (!session.session_id) continue;
    sessions.set(session.session_id, {
      session_id: session.session_id,
      child_id: session.child_id || null,
      composite_score: session.composite_score || null,
      task_score: session.task_score || null,
      passive_score: session.passive_score || null,
      z_score: session.z_score || null,
      if_score: session.if_score || null,
      anomaly_flagged: session.anomaly_flagged || false,
      alert_triggered: session.alert_triggered || false,
      gate_decision: session.gate_decision || null,
      created_at: session.created_at || new Date().toISOString(),
    });
    count++;
  }
  return count;
}

export async function getCampSummaries() {
  const campMap = new Map();

  for (const child of children.values()) {
    const campId = child.camp_id || 'unknown';
    if (!campMap.has(campId)) {
      campMap.set(campId, {
        id: campId,
        children: 0,
        sessions: 0,
        total_score: 0,
        score_count: 0,
        flagged_sessions: 0,
        total_alerts: 0,
        pending_alerts: 0,
        grade_distribution: new Map(),
        language_distribution: new Map(),
      });
    }
    const camp = campMap.get(campId);
    camp.children++;
    const grade = child.grade || 'unknown';
    camp.grade_distribution.set(grade, (camp.grade_distribution.get(grade) || 0) + 1);
    const lang = child.language || 'unknown';
    camp.language_distribution.set(lang, (camp.language_distribution.get(lang) || 0) + 1);
  }

  for (const session of sessions.values()) {
    const child = children.get(session.child_id);
    const campId = child?.camp_id || 'unknown';
    if (!campMap.has(campId)) continue;
    const camp = campMap.get(campId);
    camp.sessions++;
    if (session.composite_score != null) {
      camp.total_score += session.composite_score;
      camp.score_count++;
    }
    if (session.anomaly_flagged) camp.flagged_sessions++;
  }

  for (const alert of alerts.values()) {
    const camp = campMap.get(alert.camp_id);
    if (!camp) continue;
    camp.total_alerts++;
    if (alert.status === 'pending') camp.pending_alerts++;
  }

  return Array.from(campMap.values()).map((camp) => ({
    ...camp,
    avg_composite: camp.score_count > 0 ? Math.round(camp.total_score / camp.score_count) : 0,
    grade_distribution: Array.from(camp.grade_distribution.entries()).map(([grade, count]) => ({ grade, count })),
    language_distribution: Array.from(camp.language_distribution.entries()).map(([language, count]) => ({ language, count })),
  }));
}

export async function getCampEducation(campId) {
  const campChildren = Array.from(children.values()).filter((c) => c.camp_id === campId);
  if (campChildren.length === 0) return null;

  const childIds = new Set(campChildren.map((c) => c.child_id));
  const campSessions = Array.from(sessions.values()).filter((s) => childIds.has(s.child_id));
  const campAlerts = Array.from(alerts.values()).filter((a) => a.camp_id === campId);

  let totalScore = 0;
  let scoreCount = 0;
  const childMap = new Map();

  for (const child of campChildren) {
    childMap.set(child.child_id, {
      ...child,
      recent_scores: [],
    });
  }

  for (const session of campSessions) {
    if (session.composite_score != null) {
      totalScore += session.composite_score;
      scoreCount++;
    }
    const child = childMap.get(session.child_id);
    if (child) {
      child.recent_scores.push({
        session_id: session.session_id,
        score: session.composite_score,
        created_at: session.created_at,
      });
    }
  }

  for (const child of childMap.values()) {
    child.recent_scores.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    child.recent_scores = child.recent_scores.slice(0, 5);
  }

  const pendingAlerts = campAlerts.filter((a) => a.status === 'pending').length;

  const gradeMap = new Map();
  const langMap = new Map();
  for (const child of campChildren) {
    const grade = child.grade || 'unknown';
    gradeMap.set(grade, (gradeMap.get(grade) || 0) + 1);
    const lang = child.language || 'unknown';
    langMap.set(lang, (langMap.get(lang) || 0) + 1);
  }

  return {
    id: campId,
    children_count: campChildren.length,
    sessions_count: campSessions.length,
    avg_composite: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
    pending_alerts: pendingAlerts,
    children: Array.from(childMap.values()),
    alerts: campAlerts,
    grade_distribution: Array.from(gradeMap.entries()).map(([grade, count]) => ({ grade, count })),
    language_distribution: Array.from(langMap.entries()).map(([language, count]) => ({ language, count })),
  };
}
