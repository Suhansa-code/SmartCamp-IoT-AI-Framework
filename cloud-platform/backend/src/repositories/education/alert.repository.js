/**
 * Education domain repository — data-access layer for PAGES alerts.
 *
 * In-memory implementation backed by the static seed in
 * src/data/education/education.data.js. It exposes the same interface the
 * SQLite model exposed so controllers/services never change when a real
 * database adapter is swapped in later (the repository is the single seam).
 *
 * TODO(db): when persistence is connected, replace the Maps below with DB
 * queries while keeping this exact function/field contract.
 */
import { EDUCATION_SEED } from '../../data/education/education.data.js';

const store = {
  children: new Map(),
  sessions: new Map(),
  alerts: new Map(),
};

for (const child of EDUCATION_SEED.children) store.children.set(child.child_id, { ...child });
for (const session of EDUCATION_SEED.sessions) store.sessions.set(session.session_id, { ...session });
for (const alert of EDUCATION_SEED.alerts) store.alerts.set(alert.alert_id, { ...alert });

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

function recentScoresFor(childId, limit = 5) {
  const sessions = [...store.sessions.values()]
    .filter((s) => s.child_id === childId && s.composite_score !== null && s.composite_score !== undefined)
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, limit);

  return sessions
    .map((s) => Math.round(s.composite_score))
    .filter((s) => s !== null)
    .reverse();
}

function sessionsForChild(childId, limit = 8) {
  return [...store.sessions.values()]
    .filter((s) => s.child_id === childId && s.composite_score !== null && s.composite_score !== undefined)
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, limit)
    .map((s) => ({ score: Math.round(s.composite_score), date: s.created_at }))
    .reverse();
}

export function getAlerts(status = null, campId = null) {
  let alerts = [...store.alerts.values()];

  if (status) alerts = alerts.filter((a) => a.status === status);
  if (campId && campId !== 'all') alerts = alerts.filter((a) => a.camp_id === campId);

  alerts.sort((a, b) => (a.triggered_at > b.triggered_at ? -1 : 1));

  return alerts.map((alert) => {
    const child = store.children.get(alert.child_id) || {};
    return {
      ...alert,
      grade: child.grade ?? null,
      language: child.language ?? null,
      baseline_score: child.baseline_score ?? null,
      recent_scores: recentScoresFor(alert.child_id, 5),
      trigger_detail: parseTriggerDetail(alert.trigger_detail),
    };
  });
}

export function getAlert(alertId) {
  const alert = store.alerts.get(alertId);
  if (!alert) return null;

  const child = store.children.get(alert.child_id) || {};
  return {
    ...alert,
    grade: child.grade ?? null,
    language: child.language ?? null,
    baseline_score: child.baseline_score ?? null,
    trigger_detail: parseTriggerDetail(alert.trigger_detail),
  };
}

export function upsertAlert(alertData) {
  const { alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at } = alertData;

  const existing = store.alerts.get(alert_id) || {};
  store.alerts.set(alert_id, {
    ...existing,
    alert_id,
    child_id,
    res_id: res_id ?? null,
    camp_id,
    alert_type,
    trigger_detail: typeof trigger_detail === 'string' ? trigger_detail : JSON.stringify(trigger_detail ?? null),
    triggered_at,
    status: 'pending',
    resolved_at: null,
    resolved_notes: null,
  });

  return { success: true, alert_id };
}

export function resolveAlert(alertId, notes = null) {
  const alert = store.alerts.get(alertId);
  if (!alert) return false;

  alert.status = 'resolved';
  alert.resolved_at = new Date().toISOString();
  alert.resolved_notes = notes;
  return true;
}

export function syncChildren(children) {
  for (const child of children) {
    const existing = store.children.get(child.child_id) || {};
    store.children.set(child.child_id, {
      ...existing,
      child_id: child.child_id,
      res_id: child.res_id ?? existing.res_id ?? null,
      camp_id: child.camp_id ?? existing.camp_id ?? null,
      grade: child.grade ?? existing.grade ?? null,
      language: child.language ?? existing.language ?? null,
      baseline_score: child.baseline_score ?? existing.baseline_score ?? null,
    });
  }
  return children.length;
}

export function syncSessions(sessions) {
  for (const session of sessions) {
    const existing = store.sessions.get(session.session_id) || {};
    store.sessions.set(session.session_id, {
      ...existing,
      session_id: session.session_id,
      child_id: session.child_id,
      composite_score: session.composite_score ?? existing.composite_score ?? null,
      anomaly_flagged: session.anomaly_flagged ? 1 : 0,
      alert_triggered: session.alert_triggered ? 1 : 0,
      created_at: session.created_at ?? existing.created_at ?? new Date().toISOString(),
    });
  }
  return sessions.length;
}

/**
 * Per-camp education summaries for the Education Insights view.
 * Mirrors the SQL aggregation: children grouped by camp, joined with
 * sessions and alerts belonging to those children.
 */
export function getCampSummaries() {
  const childrenByCamp = new Map();
  for (const child of store.children.values()) {
    const list = childrenByCamp.get(child.camp_id) || [];
    list.push(child);
    childrenByCamp.set(child.camp_id, list);
  }

  const summaries = [];
  for (const [campId, campChildren] of [...childrenByCamp.entries()].sort((a, b) => (a[0] > b[0] ? 1 : -1))) {
    const childIds = new Set(campChildren.map((c) => c.child_id));
    const campSessions = [...store.sessions.values()].filter((s) => childIds.has(s.child_id));
    const campAlerts = [...store.alerts.values()].filter((a) => a.camp_id === campId);

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
 * synced children (mirrors the SQL model).
 */
export function getCampEducation(campId) {
  const children = [...store.children.values()]
    .filter((c) => c.camp_id === campId)
    .sort((a, b) => (a.child_id > b.child_id ? 1 : -1));

  if (children.length === 0) return null;

  const childIds = new Set(children.map((c) => c.child_id));
  const sessions = [...store.sessions.values()]
    .filter((s) => childIds.has(s.child_id))
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  const alerts = [...store.alerts.values()]
    .filter((a) => a.camp_id === campId)
    .sort((a, b) => (a.triggered_at > b.triggered_at ? -1 : 1));

  const recentByChild = {};
  for (const child of children) {
    recentByChild[child.child_id] = sessionsForChild(child.child_id, 8);
  }

  const scored = sessions.filter((s) => s.composite_score !== null && s.composite_score !== undefined);
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
    grade_distribution: Object.entries(gradeDist).map(([grade, count]) => ({ grade: Number(grade), count })),
    language_distribution: Object.entries(langDist).map(([language, count]) => ({ language, count })),
    children: children.map((child) => ({
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
