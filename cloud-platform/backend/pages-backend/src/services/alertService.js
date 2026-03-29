'use strict';

const { db }      = require('../config/database');
const logger      = require('../utils/logger');
const C           = require('../config/constants');
const { newId, nowISO, enqueue } = require('../utils/helpers');

/**
 * Run the alert check for a child after a flagged session.
 * Called only when anomaly_flagged = true on any session.
 *
 * All DB operations are wrapped in a single transaction.
 *
 * @param {string} childId
 * @param {string} sessionId  — the session that triggered the check
 */
function checkAndCreateAlert(childId, sessionId) {
  // Step 1: Get last 5 sessions ordered newest first
  const recentSessions = db.prepare(`
    SELECT session_id, anomaly_flagged, composite_score, created_at
    FROM   pages_sessions
    WHERE  child_id = ?
    ORDER  BY created_at DESC
    LIMIT  5
  `).all(childId);

  if (recentSessions.length === 0) return;

  const flaggedCount = recentSessions.filter(s => s.anomaly_flagged === 1).length;

  // Step 2: Check condition A — last 3 all flagged
  const last3      = recentSessions.slice(0, 3);
  const allFlagged = last3.length === 3 && last3.every(s => s.anomaly_flagged === 1);

  // Step 3: Check condition B — 3 of last 5 flagged
  const threeOfFive = flaggedCount >= C.ALERT_OF_FIVE;

  if (!allFlagged && !threeOfFive) {
    logger.debug(`[ALERT] No alert condition met for child ${childId}`);
    return;
  }

  const alertType = allFlagged
    ? C.ALERT_TYPES.CONSECUTIVE
    : C.ALERT_TYPES.OF_FIVE;

  // Step 4: Check for existing pending alert — don't duplicate
  const existing = db.prepare(`
    SELECT alert_id FROM pages_alerts
    WHERE  child_id = ? AND status = 'pending'
    LIMIT  1
  `).get(childId);

  if (existing) {
    logger.info(
      `[ALERT] Pending alert already exists for child ${childId} — skipping duplicate`
    );
    return;
  }

  // Step 5: Get child info (res_id, camp_id) for alert record
  const child = db.prepare(`
    SELECT child_id, res_id, camp_id FROM pages_children WHERE child_id = ?
  `).get(childId);

  if (!child) {
    logger.error(`[ALERT] Child not found: ${childId}`);
    return;
  }

  // Build trigger detail (last 5 scores for admin context)
  const recentScores = recentSessions
    .map(s => s.composite_score !== null ? Math.round(s.composite_score) : null)
    .filter(s => s !== null)
    .reverse();   // oldest → newest

  const triggerDetail = JSON.stringify({
    trigger_session: sessionId,
    alert_condition: alertType,
    recent_scores:   recentScores,
    checked_at:      nowISO(),
  });

  const alertId = newId();

  // Step 6 + 7: Insert alert + update child status + enqueue — all in one transaction
  const createAlert = db.transaction(() => {
    db.prepare(`
      INSERT INTO pages_alerts
        (alert_id, child_id, camp_id, res_id, alert_type, trigger_detail)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(alertId, childId, child.camp_id, child.res_id, alertType, triggerDetail);

    db.prepare(`
      UPDATE pages_children SET alert_status = 'active' WHERE child_id = ?
    `).run(childId);

    // Mark the session as having triggered an alert
    db.prepare(`
      UPDATE pages_sessions SET alert_triggered = 1 WHERE session_id = ?
    `).run(sessionId);

    enqueue('pages_alerts', alertId, 'INSERT');
  });

  createAlert();

  logger.info(
    `[ALERT] Created alert ${alertId} for child ${childId}: type=${alertType}, recent_scores=${recentScores}`
  );
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
  const whereClause = status ? `WHERE a.status = ?` : `WHERE 1=1`;
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

module.exports = { checkAndCreateAlert, getAlerts, resolveAlert };