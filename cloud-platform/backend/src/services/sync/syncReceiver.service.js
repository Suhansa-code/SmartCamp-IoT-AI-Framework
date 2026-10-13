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
  isSyncProcessed, logSync, getBehavioralSignals,
  upsertDevice, upsertPerson, upsertCheckin, upsertWristband, upsertDistribution,
  upsertResource, upsertResourceUsage, upsertAuditLog,
  upsertChild, upsertSession, upsertBehavioralSignal,
  upsertGateDecision, upsertAlert, upsertContentResponse,
  upsertDisasterEvent, upsertSensorReading, upsertEnvironmentalData,
  upsertWaterLevelReading, upsertGpsReading, upsertWeatherData,
  upsertHydrospatialData, upsertFloodPrediction, upsertDisasterAlert,
  upsertPredictionRequest,
  upsertNetworkStatus,
} from '../../data/sync/sync.postgres.repository.js';
import { applySyncedPerson, applySyncedWristband } from '../resources/campData.service.js';

/**
 * Entities whose rows also live in the resources roster held in memory.
 *
 * Persisting is not enough: /api/resources reads that roster, and it is only
 * populated by hydrateFromDb() at boot. Without this, a registration synced
 * from the Pi is invisible to every resource prediction until a restart.
 */
const LIVE_STORE_HANDLERS = {
  persons:    applySyncedPerson,
  wristbands: applySyncedWristband,
};

const { host, port, username, password, caCertPath } = env.emqx;

/**
 * ML service URL for IF auto-trigger after session sync.
 */
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

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
  'network-status':      upsertNetworkStatus,
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
 * Trigger IF scoring on the ML service after a session is synced.
 * Looks up raw behavioral signals from pages_behavioral_signals to pass
 * the correct 8-feature vector to the IF model.
 * This is async and non-blocking — failures are logged but don't affect the sync.
 */
async function triggerIfScoring(payload) {
  if (!payload?.session_id || !payload?.child_id) return;

  try {
    const signals = await getBehavioralSignals(payload.session_id);

    const taskMetrics = signals ? {
      accuracyRate: signals.accuracy_rate,
      falseTapRate: signals.false_tap_rate,
      avgReactionTime: signals.avg_reaction_time,
      reactionVariance: signals.reaction_variance,
    } : {};

    const passiveSignals = signals ? {
      idleTimeRatio: signals.idle_time_ratio,
      rapidClickCount: signals.rapid_click_count,
      timeToFirstMs: signals.time_to_first_ms,
      completionRatio: signals.completion_ratio,
    } : {};

    const res = await fetch(`${ML_SERVICE_URL}/trigger-if`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        child_id: payload.child_id,
        session_id: payload.session_id,
        composite_score: payload.composite_score,
        task_score: payload.task_score,
        passive_score: payload.passive_score,
        taskMetrics,
        passiveSignals,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const result = await res.json();
      console.log(`[Sync Receiver] IF triggered for child=${payload.child_id} session=${payload.session_id} if=${result.if_score}`);
    } else {
      console.warn(`[Sync Receiver] IF trigger returned ${res.status}`);
    }
  } catch (err) {
    console.warn(`[Sync Receiver] IF trigger failed: ${err.message}`);
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
  const { sync_id, entity, local_id, operation, camp_id, payload } = envelope;

  if (!sync_id || !entity || !payload) {
    console.warn('[Sync Receiver] Invalid envelope: missing sync_id/entity/payload');
    console.warn('[Sync Receiver] Topic:', topic, '| Keys:', Object.keys(envelope).join(','), '| Snippet:', JSON.stringify(envelope).slice(0, 200));
    return;
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

  // Auto-register device if we have both device_id and camp_id
  if (envelope.device_id && camp_id) {
    try {
      await upsertDevice(envelope.device_id, camp_id, null);
    } catch (devErr) {
      console.warn(`[Sync Receiver] Device registration failed: ${devErr.message}`);
    }
  }

  try {
    // Handlers take (row, ctx). ctx was never passed, so every device_id and
    // camp_id column the schema added for multi-camp filtering stayed NULL —
    // and the FK stubs below need the camp id to satisfy children.camp_id.
    await handler(payload, {
      device_id: envelope.device_id,
      camp_id,
    });

    // Keep the in-memory roster in step with what was just written. Guarded
    // so a roster bug can never fail a sync that already committed to Postgres.
    const applyLive = LIVE_STORE_HANDLERS[entity];
    if (applyLive) {
      try {
        applyLive(payload, { camp_id });
      } catch (liveErr) {
        console.error(`[Sync Receiver] Live roster update failed for ${entity} id=${local_id}: ${liveErr.message}`);
      }
    }

    await logSync(sync_id, entity, local_id, camp_id, operation, envelope.device_id, envelope.priority);
    processedCount++;
    console.log(`[Sync Receiver] ${entity} ${operation} id=${local_id} (QoS ${envelope.priority})`);
    publishAck(envelope, 'ok');
  } catch (err) {
    errorCount++;
    console.error(`[Sync Receiver] Failed to persist ${entity} id=${local_id}: ${err.message}`);
    publishAck(envelope, 'error', err.message);
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
    client.subscribe('smartcamp/sync/#', { qos: 1 }, (err) => {
      if (err) console.error('[Sync Receiver] Subscribe failed:', err.message);
      else console.log('[Sync Receiver] Subscribed to smartcamp/sync/# (QoS 1)');
    });
  });

  client.on('message', (topic, message) => {
    if (topic.startsWith('smartcamp/sync/') && !topic.startsWith('smartcamp/sync/ack/')) {
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
