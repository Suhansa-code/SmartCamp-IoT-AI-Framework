import { pagesDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { newId, nowISO } from '../../utils/helpers.js';
import { enqueueSync } from '../sync/sync-notify.js';

export function checkAndCreateAlert(childId, sessionId) {
  try {
    logger.info(`[ALERT] Checking alert conditions for child ${childId}`);

    const child = pagesDb.prepare(
      'SELECT child_id, camp_id, res_id, consecutive_low FROM pages_children WHERE child_id = ?'
    ).get(childId);
    if (!child) {
      logger.warn(`[ALERT] Child not found: ${childId}`);
      return;
    }

    const recent = pagesDb.prepare(`
      SELECT session_id, anomaly_flagged FROM pages_sessions
      WHERE child_id = ? AND composite_score IS NOT NULL
      ORDER BY created_at DESC LIMIT 5
    `).all(childId);

    const recentFlags = recent.map((s) => Number(s.anomaly_flagged) === 1);
    const consecutiveWindow = recentFlags.slice(0, C.ALERT_CONSECUTIVE);
    const hasConsecutiveFlagged =
      consecutiveWindow.length >= C.ALERT_CONSECUTIVE && consecutiveWindow.every(Boolean);

    if (hasConsecutiveFlagged && !hasPendingAlert(childId, '3_consecutive_flagged')) {
      createAlert(
        child,
        '3_consecutive_flagged',
        `Session ${sessionId}: ${C.ALERT_CONSECUTIVE} consecutive anomaly-flagged sessions`,
      );
    }

    if (recent.length >= 5) {
      const flaggedCount = recentFlags.filter(Boolean).length;
      if (flaggedCount >= C.ALERT_OF_FIVE && !hasPendingAlert(childId, '3_of_5_flagged')) {
        createAlert(child, '3_of_5_flagged', `Session ${sessionId}: ${flaggedCount}/5 recent sessions flagged`);
      }
    }
  } catch (err) {
    logger.error(`[ALERT] checkAndCreateAlert error: ${err.message}`);
  }
}

function hasPendingAlert(childId, alertType) {
  const row = pagesDb.prepare(`
    SELECT 1 AS exists_flag FROM pages_alerts
    WHERE child_id = ? AND alert_type = ? AND status = 'pending'
    LIMIT 1
  `).get(childId, alertType);
  return Boolean(row);
}

function createAlert(child, alertType, detail) {
  const alertId = newId();
  pagesDb.prepare(`
    INSERT INTO pages_alerts (alert_id, child_id, camp_id, res_id, alert_type, trigger_detail, triggered_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(alertId, child.child_id, child.camp_id, child.res_id, alertType, detail, nowISO());
  enqueueSync('pages_alerts', alertId);
  logger.info(`[ALERT] Created ${alertType} alert for child ${child.child_id}: ${detail}`);
}

export function getAlerts(status) {
  const whereClause = status ? 'WHERE a.status = ?' : '';
  const params = status ? [status] : [];

  const alerts = pagesDb.prepare(`
    SELECT a.alert_id, a.child_id, a.camp_id, a.res_id, a.alert_type,
           a.trigger_detail, a.triggered_at, a.status, a.resolved_at, a.resolved_notes
    FROM pages_alerts a ${whereClause}
    ORDER BY a.triggered_at DESC
  `).all(...params);

  return alerts.map((alert) => {
    const recentSessions = pagesDb.prepare(`
      SELECT composite_score FROM pages_sessions
      WHERE child_id = ? ORDER BY created_at DESC LIMIT 5
    `).all(alert.child_id);
    const recentScores = recentSessions
      .map((s) => (s.composite_score !== null ? Math.round(s.composite_score) : null))
      .filter((s) => s !== null)
      .reverse();
    return { ...alert, recent_scores: recentScores };
  });
}

export function resolveAlert(alertId, notes) {
  const alert = pagesDb.prepare('SELECT alert_id, child_id FROM pages_alerts WHERE alert_id = ?').get(alertId);
  if (!alert) return false;

  const resolveTransaction = pagesDb.transaction(() => {
    pagesDb.prepare(`
      UPDATE pages_alerts SET status = 'resolved', resolved_at = ?, resolved_notes = ?
      WHERE alert_id = ?
    `).run(nowISO(), notes || null, alertId);

    const pendingCount = pagesDb.prepare(`
      SELECT COUNT(*) AS cnt FROM pages_alerts WHERE child_id = ? AND status = 'pending'
    `).get(alert.child_id).cnt;

    if (pendingCount === 0) {
      pagesDb.prepare("UPDATE pages_children SET alert_status = 'none' WHERE child_id = ?").run(alert.child_id);
    }
  });

  resolveTransaction();
  enqueueSync('pages_alerts', alertId);
  logger.info(`[ALERT] Resolved alert ${alertId}`);
  return true;
}
