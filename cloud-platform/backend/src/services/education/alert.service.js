/**
 * Alert service — business logic for the Education domain (PAGES alerts).
 * Controllers only parse HTTP concerns; everything else lives here.
 */
import * as alertModel from '../../models/education/alert.model.js';

export function listAlerts({ status = null, camp = null } = {}) {
  const alerts = alertModel.getAlerts(status || null, camp || null);

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

export function getAlertDetails(alertId) {
  return alertModel.getAlert(alertId);
}

export function resolveAlert(alertId, notes = null) {
  return alertModel.resolveAlert(alertId, notes || null);
}

export function receiveAlert(alertData) {
  return alertModel.upsertAlert(alertData);
}

export function getAlertStats() {
  const pending = alertModel.getAlerts('pending');
  const resolved = alertModel.getAlerts('resolved');

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

export function syncChildren(children) {
  if (!Array.isArray(children) || children.length === 0) {
    return { synced: 0, message: 'No children to sync' };
  }
  const count = alertModel.syncChildren(children);
  return { synced: count, message: `Synced ${count} children` };
}

export function syncSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return { synced: 0, message: 'No sessions to sync' };
  }
  const count = alertModel.syncSessions(sessions);
  return { synced: count, message: `Synced ${count} sessions` };
}