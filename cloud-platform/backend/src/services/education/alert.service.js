/**
 * Alert service — business logic for the Education domain (PAGES alerts).
 * Controllers only parse HTTP concerns; everything else lives here.
 * Data access goes through the repository layer (memory or PostgreSQL).
 */
import * as alertRepository from '../../repositories/education/alert.repository.js';

export async function listAlerts({ status = null, camp = null } = {}) {
  const alerts = await alertRepository.getAlerts(status || null, camp || null);

  const stats = {
    total: alerts.length,
    pending: alerts.filter((a) => a.status === 'pending').length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
    by_type: alerts.reduce((acc, a) => {
      acc[a.alert_type] = (acc[a.alert_type] || 0) + 1;
      return acc;
    }, {}),
  };

  return { stats, alerts };
}

export async function getAlertDetails(alertId) {
  return alertRepository.getAlert(alertId);
}

export async function resolveAlert(alertId, notes = null) {
  return alertRepository.resolveAlert(alertId, notes || null);
}

export async function receiveAlert(alertData) {
  return alertRepository.upsertAlert(alertData);
}

export async function getAlertStats() {
  const pending = await alertRepository.getAlerts('pending');
  const resolved = await alertRepository.getAlerts('resolved');

  const stats = {
    pending_count: pending.length,
    resolved_count: resolved.length,
    total_count: pending.length + resolved.length,
    by_type: {},
    by_camp: {},
    recent_30days: pending.filter((a) => {
      const date = new Date(a.triggered_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return date >= thirtyDaysAgo;
    }).length,
  };

  [...pending, ...resolved].forEach((a) => {
    stats.by_type[a.alert_type] = (stats.by_type[a.alert_type] || 0) + 1;
    stats.by_camp[a.camp_id] = (stats.by_camp[a.camp_id] || 0) + 1;
  });

  return stats;
}

export async function syncChildren(children) {
  if (!Array.isArray(children) || children.length === 0) {
    return { synced: 0, message: 'No children to sync' };
  }
  const count = await alertRepository.syncChildren(children);
  return { synced: count, message: `Synced ${count} children` };
}

export async function syncSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return { synced: 0, message: 'No sessions to sync' };
  }
  const count = await alertRepository.syncSessions(sessions);
  return { synced: count, message: `Synced ${count} sessions` };
}

/** Education Insights — per-camp summaries for the camps list. */
export async function listCampSummaries() {
  return alertRepository.getCampSummaries();
}

/** Education Insights — full detail for a single camp. */
export async function getCampEducation(campId) {
  return alertRepository.getCampEducation(campId);
}