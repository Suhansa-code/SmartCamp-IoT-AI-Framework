/**
 * syncReceiver.service.js — Cloud-side MQTT subscriber for smartcamp/sync/*.
 *
 * Receives per-record sync messages from the Raspberry Pi, checks idempotency
 * via sync_log, persists to Neon PostgreSQL using idempotent upserts, and
 * publishes ACK to smartcamp/sync/ack/<device_id>.
 *
 * Connects directly to EMQX (same pattern as campData.service.js).
 */
import mqtt from 'mqtt';
import fs from 'fs';
import { env } from '../../config/env.js';
import {
  isSyncProcessed, logSync,
  upsertPerson, upsertCheckin, upsertWristband, upsertDistribution,
  upsertResource, upsertResourceUsage, upsertAuditLog,
  upsertChild, upsertSession, upsertBehavioralSignal,
  upsertGateDecision, upsertAlert, upsertContentResponse,
  upsertDisasterEvent, upsertSensorReading, upsertEnvironmentalData,
  upsertWaterLevelReading, upsertGpsReading, upsertWeatherData,
  upsertHydrospatialData, upsertFloodPrediction, upsertDisasterAlert,
  upsertPredictionRequest,
  upsertDevice,
} from '../../data/sync/sync.postgres.repository.js';

const { host, port, username, password, caCertPath } = env.emqx;

/**
 * Entity name → upsert function mapping.
 */
const ENTITY_HANDLERS = {
  persons:              upsertPerson,
  checkins:             upsertCheckin,
  wristbands:           upsertWristband,
  distributions:        upsertDistribution,
  resources:            upsertResource,
  'resource-usage':     upsertResourceUsage,
  'audit-logs':         upsertAuditLog,
  children:             upsertChild,
  sessions:             upsertSession,
  'behavioral-signals': upsertBehavioralSignal,
  'gate-decisions':     upsertGateDecision,
  alerts:               upsertAlert,
  'content-responses':  upsertContentResponse,
  'disaster-events':    upsertDisasterEvent,
  'sensor-readings':    upsertSensorReading,
  'environmental-data': upsertEnvironmentalData,
  'water-level-readings': upsertWaterLevelReading,
  'gps-readings':       upsertGpsReading,
  'weather-data':       upsertWeatherData,
  'hydrospatial-data':  upsertHydrospatialData,
  'flood-predictions':  upsertFloodPrediction,
  'disaster-alerts':    upsertDisasterAlert,
  'prediction-requests': upsertPredictionRequest,
};

let client = null;
let isConnected = false;
let receivedCount = 0;
let processedCount = 0;
let duplicateCount = 0;
let errorCount = 0;

/**
 * Publish an ACK message to the originating device.
 *
 * ACK topic: smartcamp/sync/ack/<device_id>
 * ACK payload:
 *   sync_id        — the original sync_id from the envelope
 *   entity         — entity type
 *   local_id       — the local record ID
 *   status         — 'ok' | 'error' | 'duplicate'
 *   cloud_record_id — same as local_id for upsert (available for future use)
 *   camp_id        — from the original envelope
 *   timestamp      — when the ACK was generated
 *   error          — error message if status is 'error'
 */
function publishAck(envelope, status, error) {
  if (!client || !isConnected || !envelope.device_id) return;

  const ackTopic = `smartcamp/sync/ack/${envelope.device_id}`;
  const ack = {
    sync_id: envelope.sync_id,
    entity: envelope.entity,
    local_id: envelope.local_id,
    status,
    cloud_record_id: envelope.local_id,
    camp_id: envelope.camp_id,
    timestamp: new Date().toISOString(),
    ...(error ? { error } : {}),
  };

  try {
    client.publish(ackTopic, JSON.stringify(ack), { qos: 1 }, (err) => {
      if (err) console.error(`[Sync Receiver] ACK publish failed: ${err.message}`);
      else console.log(`[Sync Receiver] ACK → ${ackTopic} (${status})`);
    });
  } catch (err) {
    console.error(`[Sync Receiver] ACK publish error: ${err.message}`);
  }
}

/**
 * Handle a single sync message.
 * 1. Parse the envelope.
 * 2. Check idempotency (sync_id already processed?).
 * 3. Look up the entity handler.
 * 4. Upsert the payload to Neon.
 * 5. Log the sync_id.
 * 6. Publish ACK to originating device.
 */
async function handleSyncMessage(topic, buffer) {
  let envelope;
  try {
    envelope = JSON.parse(buffer.toString());
  } catch {
    console.error('[Sync Receiver] Failed to parse message');
    return;
  }

  receivedCount++;
  const { sync_id, entity, local_id, operation, camp_id, device_id, payload } = envelope;

  if (!sync_id || !entity || !payload) {
    console.warn('[Sync Receiver] Invalid envelope: missing sync_id/entity/payload');
    console.warn('[Sync Receiver] Topic:', topic, '| Keys:', Object.keys(envelope).join(','), '| Snippet:', JSON.stringify(envelope).slice(0, 200));
    return;
  }

  // Auto-register device if unknown
  if (device_id && camp_id) {
    try {
      await upsertDevice(device_id, camp_id);
    } catch (err) {
      console.error(`[Sync Receiver] Failed to register device ${device_id}: ${err.message}`);
    }
  }

  // Idempotency check — already persisted, send success ACK again
  if (await isSyncProcessed(sync_id)) {
    duplicateCount++;
    publishAck(envelope, 'duplicate');
    return;
  }

  const handler = ENTITY_HANDLERS[entity];
  if (!handler) {
    console.warn(`[Sync Receiver] Unknown entity: ${entity}`);
    publishAck(envelope, 'error', `Unknown entity: ${entity}`);
    return;
  }

  try {
    const ctx = { device_id: device_id || null };
    await handler(payload, ctx);
    await logSync(sync_id, entity, local_id, camp_id, operation, device_id);
    processedCount++;
    console.log(`[Sync Receiver] ${entity} ${operation} id=${local_id} device=${device_id || 'n/a'} (QoS ${envelope.priority})`);
    publishAck(envelope, 'ok');
  } catch (err) {
    errorCount++;
    console.error(`[Sync Receiver] Failed to persist ${entity} id=${local_id}: ${err.message}`);
    publishAck(envelope, 'error', err.message);
  }
}

async function handleAlertMessage(topic, buffer) {
  let alert;
  try { alert = JSON.parse(buffer.toString()); } catch { return; }
  const allowedTypes = new Set(['FLOOD_RISK_HIGH', 'FLOOD_RISK_CRITICAL', 'WATER_LEVEL_CRITICAL', 'RAINFALL_EXTREME', 'RAPID_WATER_LEVEL_RISE', 'SENSOR_FAILURE', 'HYDROSPATIAL_DATA_STALE', 'SYSTEM_OFFLINE']);
  const allowedLevels = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
  const probability = Number(alert.flood_probability);
  if (!alert.id || !alert.event_id || !alert.camp_id || !allowedTypes.has(alert.alert_type)
      || !allowedLevels.has(alert.severity) || !allowedLevels.has(alert.priority)
      || (alert.flood_probability != null && (!Number.isFinite(probability) || probability < 0 || probability > 1))) {
    console.warn('[Alert Receiver] Rejected malformed alert event');
    return;
  }
  try {
    if (await isSyncProcessed(`alert:${alert.event_id}`)) return;
    const ctx = { device_id: alert.device_id || null };
    await upsertDisasterAlert(alert, ctx);
    await logSync(`alert:${alert.event_id}`, 'disaster-alerts', alert.id, alert.camp_id, 'CREATE', alert.device_id);
    console.log(`[Alert Receiver] Persisted ${alert.alert_type} event=${alert.event_id} device=${alert.device_id || 'n/a'}`);
  } catch (err) {
    console.error(`[Alert Receiver] Failed to persist event: ${err.message}`);
  }
}

/**
 * Start the sync receiver — connects to EMQX and subscribes to smartcamp/sync/*.
 */
export function startSyncReceiver() {
  let ca;
  try { ca = fs.readFileSync(caCertPath); } catch { /* optional */ }

  client = mqtt.connect(`mqtts://${host}:${port}`, {
    clientId: `cloud-sync-${Date.now()}`,
    username,
    password,
    protocol: 'mqtts',
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    ...(ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }),
  });

  client.on('connect', () => {
    isConnected = true;
    console.log('[Sync Receiver] Connected to EMQX broker');
    client.subscribe(['smartcamp/sync/#', 'smartcamp/alerts/#'], { qos: 2 }, (err) => {
      if (err) console.error('[Sync Receiver] Subscribe failed:', err.message);
      else console.log('[Sync Receiver] Subscribed to smartcamp/sync/# (QoS 1)');
    });
  });

  client.on('message', (topic, message) => {
    if (topic.startsWith('smartcamp/alerts/')) {
      handleAlertMessage(topic, message).catch((err) => console.error(`[Alert Receiver] Handler error: ${err.message}`));
    } else if (topic.startsWith('smartcamp/sync/') && !topic.startsWith('smartcamp/sync/ack/')) {
      handleSyncMessage(topic, message).catch((err) => {
        console.error(`[Sync Receiver] Handler error: ${err.message}`);
      });
    }
  });

  client.on('close', () => { isConnected = false; });
  client.on('error', (err) => console.error('[Sync Receiver] MQTT error:', err.message));
  client.on('reconnect', () => console.log('[Sync Receiver] Reconnecting...'));

  console.log('[Sync Receiver] Started');
}

/**
 * Stop the sync receiver.
 */
export function stopSyncReceiver() {
  if (client) {
    client.end(true);
    client = null;
  }
  isConnected = false;
  console.log('[Sync Receiver] Stopped');
}

/**
 * Get sync receiver status for diagnostics.
 */
export function getSyncReceiverStatus() {
  return {
    connected: isConnected,
    received: receivedCount,
    processed: processedCount,
    duplicates: duplicateCount,
    errors: errorCount,
  };
}
