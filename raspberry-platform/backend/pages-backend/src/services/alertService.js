import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import C from '../config/constants.js';
import { newId, nowISO, enqueue } from '../utils/helpers.js';

/**
 * Run the alert check for a child after a flagged session.
 * Called only when anomaly_flagged = true on any session.
 *
 * Marks ALL sessions that meet the alert condition as alert_triggered = 1.
 *
 * @param {string} childId
 * @param {string} sessionId  — the session that triggered the check
 */
function checkAndCreateAlert(childId, sessionId) {
  // Step 1: Get ALL sessions for this child, ordered oldest → newest
  const allSessions = db.prepare(`
    SELECT session_id, anomaly_flagged, alert_triggered, composite_score, created_at
    FROM   pages_sessions
    WHERE  child_id = ?
    ORDER  BY created_at ASC
  `).all(childId);

  if (allSessions.length === 0) return;

  // Step 2: Identify which sessions meet the alert condition
  const sessionsToMark = [];
  let alertTypeTriggered = null;

  for (let i = 0; i < allSessions.length; i++) {
    const session = allSessions[i];
    
    // Skip if already marked
    if (session.alert_triggered === 1) continue;
    
    // Skip if not flagged as anomaly
    if (session.anomaly_flagged !== 1) continue;

    // Check condition A: >= ALERT_CONSECUTIVE consecutive anomalies (including current)
    let consecutiveCount = 1;
    for (let j = i - 1; j >= 0 && allSessions[j].anomaly_flagged === 1; j--) {
      consecutiveCount++;
    }

    if (consecutiveCount >= C.ALERT_CONSECUTIVE) {
      sessionsToMark.push({ sessionId: session.session_id, reason: 'consecutive' });
      alertTypeTriggered = C.ALERT_TYPES.CONSECUTIVE;
      continue;
    }

    // Check condition B: 3 of last 5 anomalies
    const last5 = allSessions.slice(Math.max(0, i - 4), i + 1);
    const flaggedCountInWindow = last5.filter(s => s.anomaly_flagged === 1).length;
    
    if (flaggedCountInWindow >= C.ALERT_OF_FIVE) {
      sessionsToMark.push({ sessionId: session.session_id, reason: 'of_five' });
      if (!alertTypeTriggered) {
        alertTypeTriggered = C.ALERT_TYPES.OF_FIVE;
      }
    }
  }

  // If no new sessions to mark, exit
  if (sessionsToMark.length === 0) {
    logger.debug(`[ALERT] No new sessions to mark for child ${childId}`);
    return;
  }

  // Step 3: Check if alert already exists
  const existing = db.prepare(`
    SELECT alert_id FROM pages_alerts
    WHERE  child_id = ? AND status = 'pending'
    LIMIT  1
  `).get(childId);

  // Step 4: Get child info
  const child = db.prepare(`
    SELECT child_id, res_id, camp_id FROM pages_children WHERE child_id = ?
  `).get(childId);

  if (!child) {
    logger.error(`[ALERT] Child not found: ${childId}`);
    return;
  }

  // Build trigger detail (last 5 scores for admin context)
  const last5Sessions = allSessions.slice(-5);
  const recentScores = last5Sessions
    .map(s => s.composite_score !== null ? Math.round(s.composite_score) : null)
    .filter(s => s !== null);

  const triggerDetail = JSON.stringify({
    trigger_session: sessionId,
    alert_condition: alertTypeTriggered,
    sessions_marked: sessionsToMark.length,
    recent_scores:   recentScores,
    checked_at:      nowISO(),
  });

  // Step 5: Update database in transaction
  const updateAlert = db.transaction(() => {
    // Mark all qualifying sessions as alert_triggered = 1
    for (const item of sessionsToMark) {
      db.prepare(`
        UPDATE pages_sessions SET alert_triggered = 1 WHERE session_id = ?
      `).run(item.sessionId);
    }

    // Only create alert if it doesn't exist
    if (!existing) {
      const alertId = newId();
      db.prepare(`
        INSERT INTO pages_alerts
          (alert_id, child_id, camp_id, res_id, alert_type, trigger_detail, triggered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(alertId, childId, child.camp_id, child.res_id, alertTypeTriggered, triggerDetail, nowISO());

      db.prepare(`
        UPDATE pages_children SET alert_status = 'active' WHERE child_id = ?
      `).run(childId);

      enqueue('pages_alerts', alertId, 'INSERT');
      
      logger.info(
        `[ALERT] Created alert ${alertId} for child ${childId}: type=${alertTypeTriggered}, marked=${sessionsToMark.length} sessions, recent_scores=${recentScores}`
      );
    } else {
      // Alert already exists, just log the marked sessions
      logger.info(
        `[ALERT] Updated existing alert for child ${childId}: marked=${sessionsToMark.length} additional sessions`
      );
    }

    // Enqueue updated sessions for sync
    for (const item of sessionsToMark) {
      enqueue('pages_sessions', item.sessionId, 'UPDATE');
    }
  });

  updateAlert();
}

/**
 * Get all alerts for the admin dashboard.
 * Includes last 5 composite scores per child for context.
 * Admin-only — never called from child-facing routes.
 *
 * @param {string} [status] — 'pending' | 'resolved' | undefined (all)
 * @returns {Array}
 */
function getAlerts(status) {
  const whereClause = status ? 'WHERE a.status = ?' : 'WHERE 1=1';
  const params      = status ? [status] : [];

  const alerts = db.prepare(`
    SELECT
      a.alert_id,
      a.child_id,
      a.camp_id,
      a.res_id,
      a.alert_type,
      a.trigger_detail,
      a.triggered_at,
      a.status,
      a.resolved_at,
      a.resolved_notes
    FROM   pages_alerts a
    ${whereClause}
    ORDER  BY a.triggered_at DESC
  `).all(...params);

  // Attach last 5 composite scores per child
  return alerts.map(alert => {
    const recentSessions = db.prepare(`
      SELECT composite_score
      FROM   pages_sessions
      WHERE  child_id = ?
      ORDER  BY created_at DESC
      LIMIT  5
    `).all(alert.child_id);

    const recentScores = recentSessions
      .map(s => s.composite_score !== null ? Math.round(s.composite_score) : null)
      .filter(s => s !== null)
      .reverse();

    return { ...alert, recent_scores: recentScores };
  });
}

/**
 * Mark an alert as resolved (admin action).
 *
 * @param {string} alertId
 * @param {string} notes
 * @returns {boolean} success
 */
function resolveAlert(alertId, notes) {
  const alert = db.prepare(`
    SELECT alert_id, child_id FROM pages_alerts WHERE alert_id = ?
  `).get(alertId);

  if (!alert) return false;

  const resolveTransaction = db.transaction(() => {
    db.prepare(`
      UPDATE pages_alerts
      SET    status = 'resolved', resolved_at = ?, resolved_notes = ?
      WHERE  alert_id = ?
    `).run(nowISO(), notes || null, alertId);

    // Check if child has any other pending alerts — if not, clear alert_status
    const pendingCount = db.prepare(`
      SELECT COUNT(*) AS cnt FROM pages_alerts
      WHERE  child_id = ? AND status = 'pending'
    `).get(alert.child_id).cnt;

    if (pendingCount === 0) {
      db.prepare(`
        UPDATE pages_children SET alert_status = 'none' WHERE child_id = ?
      `).run(alert.child_id);
    }

    enqueue('pages_alerts', alertId, 'UPDATE');
  });

  resolveTransaction();

  logger.info(`[ALERT] Resolved alert ${alertId}`);
  return true;
}

/**
 * Publish alert to MQTT cloud platform for syncing
 * Called after alert is created in the database
 *
 * @param {Object} alertData
 * @param {Object} mqttClient - MQTT client instance
 */
function publishAlertToCloud(alertData, mqttClient) {
  if (!mqttClient) {
    logger.warn('[ALERT] MQTT client not available, alert not published to cloud');
    return;
  }

  try {
    const topic = 'smartcamp/alerts/generated';
    const payload = {
      alert_id: alertData.alert_id,
      child_id: alertData.child_id,
      res_id: alertData.res_id,
      camp_id: alertData.camp_id,
      alert_type: alertData.alert_type,
      trigger_detail: alertData.trigger_detail,
      triggered_at: alertData.triggered_at
    };

    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (err) => {
      if (err) {
        logger.error(`[ALERT] Failed to publish alert to cloud: ${err.message}`);
      } else {
        logger.info(`[ALERT] ✅ Published alert ${alertData.alert_id} to cloud via MQTT`);
      }
    });
  } catch (err) {
    logger.error(`[ALERT] Error publishing alert to cloud: ${err.message}`);
  }
}

/**
 * Sync child data to cloud platform
 * Should be called periodically to keep cloud platform updated
 *
 * @param {Object} mqttClient
 */
function syncChildrenToCloud(mqttClient) {
  if (!mqttClient) {
    logger.warn('[ALERT] MQTT client not available, children not synced to cloud');
    return;
  }

  try {
    const children = db.prepare(`
      SELECT child_id, res_id, camp_id, grade, language, baseline_score
      FROM pages_children
      LIMIT 1000
    `).all();

    if (children.length === 0) return;

    const topic = 'smartcamp/data/children/sync';
    const payload = { children };

    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (err) => {
      if (err) {
        logger.error(`[ALERT] Failed to sync children to cloud: ${err.message}`);
      } else {
        logger.info(`[ALERT] ✅ Synced ${children.length} children to cloud`);
      }
    });
  } catch (err) {
    logger.error(`[ALERT] Error syncing children to cloud: ${err.message}`);
  }
}

/**
 * Sync recent sessions to cloud platform for alert context
 *
 * @param {Object} mqttClient
 */
function syncSessionsToCloud(mqttClient) {
  if (!mqttClient) {
    logger.warn('[ALERT] MQTT client not available, sessions not synced to cloud');
    return;
  }

  try {
    const sessions = db.prepare(`
      SELECT session_id, child_id, composite_score, anomaly_flagged, alert_triggered, created_at
      FROM pages_sessions
      ORDER BY created_at DESC
      LIMIT 5000
    `).all();

    if (sessions.length === 0) return;

    const topic = 'smartcamp/data/sessions/sync';
    const payload = { sessions };

    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (err) => {
      if (err) {
        logger.error(`[ALERT] Failed to sync sessions to cloud: ${err.message}`);
      } else {
        logger.info(`[ALERT] ✅ Synced ${sessions.length} sessions to cloud`);
      }
    });
  } catch (err) {
    logger.error(`[ALERT] Error syncing sessions to cloud: ${err.message}`);
  }
}

export { 
  checkAndCreateAlert, 
  getAlerts, 
  resolveAlert,
  publishAlertToCloud,
  syncChildrenToCloud,
  syncSessionsToCloud
};