import logger from '../utils/logger.js';
import {
  checkAndCreateAlert,
  publishAlertToCloud,
  syncChildrenToCloud,
  syncSessionsToCloud
} from './alertService.js';

/**
 * AlertSyncManager
 * Periodically syncs alert data from raspberry platform to cloud platform
 * via HTTP POST requests to the cloud backend
 */
class AlertSyncManager {
  constructor(cloudBaseUrl = 'http://cloud-platform-backend:3001') {
    this.cloudBaseUrl = cloudBaseUrl;
    this.syncInterval = null;
    this.isSyncing = false;
  }

  /**
   * Start the sync service
   * Syncs alerts, children, and sessions periodically
   */
  start(intervalMs = 60000) {
    logger.info(`[AlertSync] Starting alert sync service (interval: ${intervalMs}ms)`);

    // Initial sync
    this.syncAlerts();

    // Periodic sync
    this.syncInterval = setInterval(() => {
      this.syncAlerts();
    }, intervalMs);
  }

  /**
   * Stop the sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('[AlertSync] Alert sync service stopped');
    }
  }

  /**
   * Perform all syncs: children, sessions, alerts
   */
  async syncAlerts() {
    if (this.isSyncing) return;

    this.isSyncing = true;

    try {
      await this.syncChildren();
      await this.syncSessions();
      await this.syncPendingAlerts();
    } catch (err) {
      logger.error(`[AlertSync] Sync failed: ${err.message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync children data to cloud
   */
  async syncChildren() {
    try {
      const { db } = await import('../config/database.js');

      const children = db.prepare(`
        SELECT child_id, res_id, camp_id, grade, language, baseline_score
        FROM pages_children
        LIMIT 1000
      `).all();

      if (children.length === 0) return;

      const response = await fetch(`${this.cloudBaseUrl}/api/alerts/sync/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ children })
      });

      if (response.ok) {
        logger.debug(`[AlertSync] ✅ Synced ${children.length} children to cloud`);
      } else {
        logger.warn(`[AlertSync] Failed to sync children: ${response.status}`);
      }
    } catch (err) {
      logger.error(`[AlertSync] Error syncing children: ${err.message}`);
    }
  }

  /**
   * Sync recent sessions to cloud
   */
  async syncSessions() {
    try {
      const { db } = await import('../config/database.js');

      const sessions = db.prepare(`
        SELECT session_id, child_id, composite_score, anomaly_flagged, alert_triggered, created_at
        FROM pages_sessions
        WHERE created_at > datetime('now', '-7 days')
        ORDER BY created_at DESC
        LIMIT 5000
      `).all();

      if (sessions.length === 0) return;

      const response = await fetch(`${this.cloudBaseUrl}/api/alerts/sync/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions })
      });

      if (response.ok) {
        logger.debug(`[AlertSync] ✅ Synced ${sessions.length} sessions to cloud`);
      } else {
        logger.warn(`[AlertSync] Failed to sync sessions: ${response.status}`);
      }
    } catch (err) {
      logger.error(`[AlertSync] Error syncing sessions: ${err.message}`);
    }
  }

  /**
   * Sync pending (unsynced) alerts to cloud
   */
  async syncPendingAlerts() {
    try {
      const { db } = await import('../config/database.js');

      const alerts = db.prepare(`
        SELECT alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at, status
        FROM pages_alerts
        WHERE status = 'pending'
        ORDER BY triggered_at DESC
        LIMIT 1000
      `).all();

      if (alerts.length === 0) return;

      for (const alert of alerts) {
        try {
          const response = await fetch(`${this.cloudBaseUrl}/api/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alert_id: alert.alert_id,
              child_id: alert.child_id,
              res_id: alert.res_id,
              camp_id: alert.camp_id,
              alert_type: alert.alert_type,
              trigger_detail: alert.trigger_detail,
              triggered_at: alert.triggered_at
            })
          });

          if (response.ok) {
            logger.debug(`[AlertSync] ✅ Synced alert ${alert.alert_id} to cloud`);
          } else {
            logger.warn(`[AlertSync] Failed to sync alert ${alert.alert_id}: ${response.status}`);
          }
        } catch (err) {
          logger.error(`[AlertSync] Error syncing alert ${alert.alert_id}: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`[AlertSync] Error syncing alerts: ${err.message}`);
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      running: !!this.syncInterval,
      syncing: this.isSyncing,
      cloudBaseUrl: this.cloudBaseUrl
    };
  }
}

export { AlertSyncManager };
