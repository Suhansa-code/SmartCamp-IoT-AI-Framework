import { pagesDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { newId, nowISO } from '../../utils/helpers.js';
import { enqueue } from '../../utils/helpers.js';

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

    const consecutive = child.consecutive_low || 0;

    if (consecutive >= C.ALERT_CONSECUTIVE) {
      createAlert(child, '3_consecutive_flagged', `Session ${sessionId}: ${consecutive} consecutive flagged sessions`);
      resetConsecutiveLow(childId);
    }

    const recent = pagesDb.prepare(`
      SELECT anomaly_flagged FROM pages_sessions
      WHERE child_id = ? AND session_complete = 1
      ORDER BY created_at DESC LIMIT 5
    `).all(childId);

    if (recent.length >= 5) {
      const flaggedCount = recent.filter(s => s.anomaly_flagged === 1).length;
      if (flaggedCount >= C.ALERT_OF_FIVE) {
        createAlert(child, '3_of_5_flagged', `Session ${sessionId}: ${flaggedCount}/5 recent sessions flagged`);
      }
    }
  } catch (err) {
    logger.error(`[ALERT] checkAndCreateAlert error: ${err.message}`);
  }
}

function createAlert(child, alertType, detail) {
  const alertId = newId();
  pagesDb.prepare(`
    INSERT INTO pages_alerts (alert_id, child_id, camp_id, res_id, alert_type, trigger_detail, triggered_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(alertId, child.child_id, child.camp_id, child.res_id, alertType, detail, nowISO());
  enqueue('pages_alerts', alertId, 'INSERT');
  logger.info(`[ALERT] Created ${alertType} alert for child ${child.child_id}: ${detail}`);
}

function resetConsecutiveLow(childId) {
  pagesDb.prepare('UPDATE pages_children SET consecutive_low = 0 WHERE child_id = ?').run(childId);
  logger.info(`[ALERT] Reset consecutive_low for child ${childId}`);
}
