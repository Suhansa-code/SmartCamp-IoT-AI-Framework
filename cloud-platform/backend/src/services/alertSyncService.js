import mqtt from 'mqtt';
import { upsertAlert, syncChildren, syncSessions } from '../config/database.js';

/**
 * AlertSyncService
 * Listens to MQTT topics for alert data from raspberry platform
 * Syncs alerts, children, and sessions to cloud database
 */
class AlertSyncService {
  constructor(mqttClient) {
    this.mqttClient = mqttClient;
    this.isConnected = false;
  }

  /**
   * Start listening to alert topics
   */
  start() {
    if (!this.mqttClient) {
      console.warn('[AlertSync] MQTT client not available, skipping alert sync');
      return;
    }

    // Subscribe to alert topics
    this.mqttClient.subscribe([
      'smartcamp/alerts/generated',
      'smartcamp/data/children/sync',
      'smartcamp/data/sessions/sync'
    ], (err) => {
      if (err) {
        console.error('[AlertSync] Failed to subscribe to alert topics:', err.message);
      } else {
        console.log('[AlertSync] ✅ Subscribed to alert topics');
        this.isConnected = true;
      }
    });

    // Handle incoming MQTT messages
    this.mqttClient.on('message', async (topic, message) => {
      try {
        await this.handleMessage(topic, message);
      } catch (err) {
        console.error(`[AlertSync] Error handling ${topic}:`, err.message);
      }
    });
  }

  /**
   * Route incoming MQTT messages to appropriate handlers
   */
  async handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());

      switch (topic) {
        case 'smartcamp/alerts/generated':
          await this.handleAlertGenerated(payload);
          break;
        case 'smartcamp/data/children/sync':
          await this.handleChildrenSync(payload);
          break;
        case 'smartcamp/data/sessions/sync':
          await this.handleSessionsSync(payload);
          break;
        default:
          console.warn(`[AlertSync] Unknown topic: ${topic}`);
      }
    } catch (err) {
      console.error(`[AlertSync] Failed to parse message from ${topic}:`, err.message);
    }
  }

  /**
   * Handle incoming alert from raspberry platform
   * Topic: smartcamp/alerts/generated
   * Payload: { alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at }
   */
  async handleAlertGenerated(payload) {
    try {
      const {
        alert_id,
        child_id,
        res_id,
        camp_id,
        alert_type,
        trigger_detail,
        triggered_at
      } = payload;

      if (!alert_id || !child_id || !camp_id) {
        console.warn('[AlertSync] Invalid alert payload - missing required fields');
        return;
      }

      // Upsert alert to cloud database
      await upsertAlert({
        alert_id,
        child_id,
        res_id,
        camp_id,
        alert_type,
        trigger_detail,
        triggered_at
      });

      console.log(`[AlertSync] 📥 Synced alert ${alert_id} for child ${child_id}`);
    } catch (err) {
      console.error('[AlertSync] Failed to handle alert:', err.message);
    }
  }

  /**
   * Handle children data sync from raspberry platform
   * Topic: smartcamp/data/children/sync
   * Payload: { children: [...] }
   */
  async handleChildrenSync(payload) {
    try {
      const { children = [] } = payload;

      if (!Array.isArray(children) || children.length === 0) {
        console.warn('[AlertSync] Invalid children sync payload');
        return;
      }

      await syncChildren(children);
      console.log(`[AlertSync] 👶 Synced ${children.length} children`);
    } catch (err) {
      console.error('[AlertSync] Failed to sync children:', err.message);
    }
  }

  /**
   * Handle sessions data sync from raspberry platform
   * Topic: smartcamp/data/sessions/sync
   * Payload: { sessions: [...] }
   */
  async handleSessionsSync(payload) {
    try {
      const { sessions = [] } = payload;

      if (!Array.isArray(sessions) || sessions.length === 0) {
        console.warn('[AlertSync] Invalid sessions sync payload');
        return;
      }

      await syncSessions(sessions);
      console.log(`[AlertSync] 📊 Synced ${sessions.length} sessions`);
    } catch (err) {
      console.error('[AlertSync] Failed to sync sessions:', err.message);
    }
  }

  /**
   * Stop the alert sync service
   */
  stop() {
    if (this.mqttClient) {
      this.mqttClient.unsubscribe([
        'smartcamp/alerts/generated',
        'smartcamp/data/children/sync',
        'smartcamp/data/sessions/sync'
      ]);
    }
    this.isConnected = false;
    console.log('[AlertSync] Stopped');
  }

  /**
   * Check if service is connected and ready
   */
  getStatus() {
    return {
      connected: this.isConnected,
      topics: [
        'smartcamp/alerts/generated',
        'smartcamp/data/children/sync',
        'smartcamp/data/sessions/sync'
      ]
    };
  }
}

export { AlertSyncService };
