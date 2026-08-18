/**
 * AlertSyncService — listens to MQTT topics from the raspberry platform and
 * syncs alerts, children and sessions into the repository (in-memory now,
 * DB-ready later).
 */
import { upsertAlert, syncChildren, syncSessions } from '../../repositories/education/alert.repository.js';
import { ALERT_SYNC_TOPICS } from '../../data/education/alertSync.data.js';

export { ALERT_SYNC_TOPICS };

class AlertSyncService {
  constructor(mqttService) {
    this.mqttService = mqttService;
    this.isConnected = false;
  }

  start() {
    const client = this.mqttService?.client;
    if (!client) {
      console.warn('[AlertSync] MQTT client not available, skipping alert sync');
      return;
    }

    client.subscribe(ALERT_SYNC_TOPICS, (err) => {
      if (err) {
        console.error('[AlertSync] Failed to subscribe to alert topics:', err.message);
      } else {
        console.log('[AlertSync] Subscribed to alert topics');
        this.isConnected = true;
      }
    });

    client.on('message', (topic, message) => {
      try {
        this.handleMessage(topic, message);
      } catch (err) {
        console.error(`[AlertSync] Error handling ${topic}:`, err.message);
      }
    });
  }

  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());

      switch (topic) {
        case 'smartcamp/alerts/generated':
          this.handleAlertGenerated(payload);
          break;
        case 'smartcamp/data/children/sync':
          this.handleChildrenSync(payload);
          break;
        case 'smartcamp/data/sessions/sync':
          this.handleSessionsSync(payload);
          break;
        default:
          console.warn(`[AlertSync] Unknown topic: ${topic}`);
      }
    } catch (err) {
      console.error(`[AlertSync] Failed to parse message from ${topic}:`, err.message);
    }
  }

  handleAlertGenerated(payload) {
    const { alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at } = payload;

    if (!alert_id || !child_id || !camp_id) {
      console.warn('[AlertSync] Invalid alert payload - missing required fields');
      return;
    }

    upsertAlert({ alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at });
    console.log(`[AlertSync] Synced alert ${alert_id} for child ${child_id}`);
  }

  handleChildrenSync(payload) {
    const { children = [] } = payload;
    if (!Array.isArray(children) || children.length === 0) {
      console.warn('[AlertSync] Invalid children sync payload');
      return;
    }
    syncChildren(children);
    console.log(`[AlertSync] Synced ${children.length} children`);
  }

  handleSessionsSync(payload) {
    const { sessions = [] } = payload;
    if (!Array.isArray(sessions) || sessions.length === 0) {
      console.warn('[AlertSync] Invalid sessions sync payload');
      return;
    }
    syncSessions(sessions);
    console.log(`[AlertSync] Synced ${sessions.length} sessions`);
  }

  stop() {
    if (this.mqttService?.client) {
      this.mqttService.client.unsubscribe(ALERT_SYNC_TOPICS);
    }
    this.isConnected = false;
    console.log('[AlertSync] Stopped');
  }

  getStatus() {
    return {
      connected: this.isConnected,
      topics: ALERT_SYNC_TOPICS,
    };
  }
}

export { AlertSyncService };