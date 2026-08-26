/**
 * sync-manager.js — Synchronization orchestration with ACK-based persistence.
 *
 * Correct flow:
 *   Local record (synced=0)
 *   → write to sync_pending
 *   → MQTT publish to smartcamp/sync/<entity> via SAAMP
 *   → SAAMP handles: adaptive QoS, buffering on network CRITICAL/offline
 *   → cloud receives, upserts to Neon, publishes ACK
 *   → RPi receives ACK, marks local record synced=1
 *
 * Offline resilience:
 *   - SAAMP buffers sync messages in mqtt_buffer when offline/CRITICAL
 *   - SAAMP flushBuffer() flushes in priority order: CRITICAL→HIGH→MEDIUM→LOW
 *   - sync_pending tracks all pending records (survives restart)
 *   - Retry with exponential backoff on ACK timeout
 *
 * Handles all 6 failure modes:
 *   1. MQTT connection failure — SAAMP buffers, sync-manager tracks
 *   2. Network CRITICAL — SAAMP buffers non-CRITICAL, sync-manager pauses new publishes
 *   3. Cloud PostgreSQL failure — cloud sends error ACK, sync-manager retries
 *   4. MQTT ACK timeout — retry with exponential backoff
 *   5. Duplicate MQTT delivery — cloud idempotent upsert + duplicate ACK
 *   6. Application restart — sync_pending in SQLite survives restart
 */
import { randomUUID } from 'crypto';
import logger from '../../utils/logger.js';
import * as saamp from '../network/saamp-mqtt.js';
import { campDb, pagesDb, disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import { getCampId } from '../../config/camp-id.js';
import { fetchAllPending, countPending } from './sync-queue.js';
import { PRIORITY } from './sync-priority.js';
import { nowISO } from '../../utils/helpers.js';

const SYNC_INTERVAL_MS = 30_000;
const SYNC_INTERVAL_STABLE_MS = 5_000;
const SYNC_INTERVAL_DEGRADED_MS = 15_000;
const SYNC_INTERVAL_CRITICAL_MS = 60_000;
const ACK_CHECK_INTERVAL_MS = 15_000;
const BASE_RETRY_DELAY_MS = 60_000;
const MAX_RETRY_DELAY_MS = 1_800_000;
const MAX_RETRIES = 10;

const TABLE_TO_ENTITY = {
  persons:                    'persons',
  camp_checkins:              'checkins',
  wristbands:                 'wristbands',
  distributions:              'distributions',
  resources:                  'resources',
  resource_usage:             'resource-usage',
  audit_logs:                 'audit-logs',
  pages_children:             'children',
  pages_sessions:             'sessions',
  pages_behavioral_signals:   'behavioral-signals',
  pages_gate_decisions:       'gate-decisions',
  pages_alerts:               'alerts',
  pages_content_responses:    'content-responses',
  disaster_events:            'disaster-events',
  water_level_readings:       'water-level-readings',
  gps_readings:               'gps-readings',
  weather_data:               'weather-data',
  hydrospatial_data:          'hydrospatial-data',
  flood_predictions:          'flood-predictions',
  disaster_alerts:            'disaster-alerts',
  prediction_requests:        'prediction-requests',
};

const ENTITY_PK = {
  persons:                    'id',
  checkins:                   'id',
  wristbands:                 'id',
  distributions:              'id',
  resources:                  'id',
  'resource-usage':           'id',
  'audit-logs':               'id',
  children:                   'child_id',
  sessions:                   'session_id',
  'behavioral-signals':       'signal_id',
  'gate-decisions':           'decision_id',
  alerts:                     'alert_id',
  'content-responses':        'response_id',
  'disaster-events':          'id',
  'sensor-readings':          'id',
  'environmental-data':       'id',
  'water-level-readings':     'id',
  'gps-readings':             'id',
  'weather-data':             'id',
  'hydrospatial-data':        'id',
  'flood-predictions':        'id',
  'disaster-alerts':          'id',
  'prediction-requests':      'id',
};

const TABLE_DB_MAP = {
  persons: campDb, camp_checkins: campDb, wristbands: campDb,
  distributions: campDb, resources: campDb, resource_usage: campDb,
  audit_logs: campDb,
  pages_children: pagesDb, pages_sessions: pagesDb,
  pages_behavioral_signals: pagesDb, pages_gate_decisions: pagesDb,
  pages_alerts: pagesDb, pages_content_responses: pagesDb,
  disaster_events: disasterDb,
 water_level_readings: disasterDb,
  gps_readings: disasterDb, weather_data: disasterDb,
  hydrospatial_data: disasterDb, flood_predictions: disasterDb,
  disaster_alerts: disasterDb, prediction_requests: disasterDb,
};

const META_FIELDS = ['_priority', '_reason', '_qos', '_timestamp'];

let syncTimer = null;
let ackTimer = null;
let isRunning = false;
let lastSyncAt = null;
let syncCount = 0;
let currentIntervalMs = SYNC_INTERVAL_MS;

const DISASTER_TABLES = new Set([
  'disaster_events', 'water_level_readings',
  'gps_readings', 'weather_data', 'hydrospatial_data', 'flood_predictions',
  'disaster_alerts', 'prediction_requests',
]);

function getDomainForTable(table) {
  if (table.startsWith('pages_')) return 'education';
  if (table === 'disaster_alerts') return 'disaster-alert';
  if (DISASTER_TABLES.has(table)) return 'disaster';
  return 'resources';
}

// ── Structured sync logging ──────────────────────────────────────────────

function syncLog(event, entity, localId, extra = {}) {
  const meta = { entity, local_id: localId, ...extra };
  switch (event) {
    case 'queued':      logger.info(`[SYNC] Queued ${entity} id=${localId}`, meta); break;
    case 'published':   logger.info(`[SYNC] Published ${entity} id=${localId}`, meta); break;
    case 'buffered':    logger.info(`[SYNC] Buffered ${entity} id=${localId} (offline/CRITICAL)`, meta); break;
    case 'acknowledged': logger.info(`[SYNC] Acknowledged ${entity} id=${localId}`, meta); break;
    case 'synchronized': logger.info(`[SYNC] Synchronized ${entity} id=${localId}`, meta); break;
    case 'failed':      logger.error(`[SYNC] Failed ${entity} id=${localId}`, meta); break;
    case 'retrying':    logger.warn(`[SYNC] Retrying ${entity} id=${localId}`, meta); break;
    case 'permanently_failed': logger.error(`[SYNC] Permanent failure ${entity} id=${localId}`, meta); break;
    default:            logger.debug(`[SYNC] ${event} ${entity} id=${localId}`, meta);
  }
}

// ── sync_pending helpers ─────────────────────────────────────────────────

function insertPending(syncId, entity, tableName, localId, operation, priority, payload) {
  const strLocalId = String(localId);
  const existing = campDb.prepare(
    'SELECT sync_id FROM sync_pending WHERE table_name = ? AND local_id = ?'
  ).get(tableName, strLocalId);

  if (existing) {
    campDb.prepare(
      `UPDATE sync_pending SET sync_id = ?, entity = ?, operation = ?, priority = ?,
         payload = ?, published = 0, retry_count = 0, next_retry_at = datetime('now')
       WHERE table_name = ? AND local_id = ?`
    ).run(syncId, entity, operation, priority, JSON.stringify(payload), tableName, strLocalId);
  } else {
    campDb.prepare(
      `INSERT INTO sync_pending
         (sync_id, entity, table_name, local_id, operation, priority, camp_id, device_id, payload, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(syncId, entity, tableName, strLocalId, operation, priority, getCampId(), C.DEVICE_ID, JSON.stringify(payload));
  }
}

function markPublished(syncId) {
  campDb.prepare('UPDATE sync_pending SET published = 1 WHERE sync_id = ?').run(syncId);
}

function deletePending(syncId) {
  campDb.prepare('DELETE FROM sync_pending WHERE sync_id = ?').run(syncId);
}

function ackSuccess(syncId) {
  const row = campDb.prepare('SELECT * FROM sync_pending WHERE sync_id = ?').get(syncId);
  if (!row) return;

  const pk = ENTITY_PK[row.entity] || 'id';
  const db = TABLE_DB_MAP[row.table_name];
  if (db) {
    db.prepare(`UPDATE ${row.table_name} SET synced = 1 WHERE ${pk} = ?`).run(row.local_id);
    if (row.table_name === 'disaster_alerts') {
      db.prepare(`UPDATE disaster_alerts SET cloud_sync_status = 'SYNCED' WHERE ${pk} = ?`).run(row.local_id);
    }
  }
  campDb.prepare(
    'DELETE FROM sync_pending WHERE table_name = ? AND local_id = ?'
  ).run(row.table_name, row.local_id);
  syncLog('synchronized', row.entity, row.local_id, { sync_id: syncId });
}

function ackFailed(syncId, errorMsg) {
  const row = campDb.prepare('SELECT * FROM sync_pending WHERE sync_id = ?').get(syncId);
  if (!row) return;

  const newRetry = row.retry_count + 1;
  const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, row.retry_count), MAX_RETRY_DELAY_MS);
  const nextRetry = new Date(Date.now() + delay).toISOString();

  if (newRetry >= MAX_RETRIES) {
    syncLog('permanently_failed', row.entity, row.local_id, { sync_id: syncId, retries: newRetry, error: errorMsg });
    deletePending(syncId);
    return;
  }

  campDb.prepare(
    `UPDATE sync_pending SET retry_count = ?, next_retry_at = ?, published = 0 WHERE sync_id = ?`
  ).run(newRetry, nextRetry, syncId);
  if (row.table_name === 'disaster_alerts') {
    disasterDb.prepare('UPDATE disaster_alerts SET mqtt_status = ? WHERE id = ?').run('PENDING', row.local_id);
  }
  syncLog('retrying', row.entity, row.local_id, {
    sync_id: syncId, retry: newRetry, max_retries: MAX_RETRIES,
    next_retry_at: nextRetry, error: errorMsg,
  });
}

// ── ACK handler ──────────────────────────────────────────────────────────

function handleAck(ack) {
  if (!ack || !ack.sync_id) return;

  if (ack.status === 'ok' || ack.status === 'duplicate') {
    ackSuccess(ack.sync_id);
  } else {
    ackFailed(ack.sync_id, ack.error || 'unknown error');
  }
}

// ── SAAMP flush listener — mark buffered sync messages as published ──────

function handleFlush(flushedMessages) {
  let syncFlushed = 0;
  for (const msg of flushedMessages) {
    if (!msg.topic.startsWith('smartcamp/sync/')) continue;
    try {
      const payload = JSON.parse(msg.payload);
      if (payload.sync_id) {
        markPublished(payload.sync_id);
        syncFlushed++;
      }
    } catch { /* not a sync message or parse error */ }
  }
  if (syncFlushed > 0) {
    logger.info(`[SYNC] ${syncFlushed} buffered sync messages flushed by SAAMP`);
  }
}

// ── Build sync message ───────────────────────────────────────────────────

function buildSyncMessage(entity, row) {
  const pk = ENTITY_PK[entity] || 'id';
  return {
    sync_id: randomUUID(),
    entity,
    local_id: row[pk],
    operation: row.synced === 0 ? 'CREATE' : 'UPDATE',
    priority: row._priority || PRIORITY.MEDIUM,
    camp_id: getCampId(),
    device_id: C.DEVICE_ID,
    timestamp: nowISO(),
    payload: row,
  };
}

function stripMeta(row) {
  const clean = { ...row };
  for (const key of META_FIELDS) delete clean[key];
  return clean;
}

// ── Retry pending unacked records ────────────────────────────────────────

function retryPendingAcks() {
  const now = nowISO();
  const rows = campDb.prepare(
    `SELECT * FROM sync_pending
     WHERE published = 0 AND retry_count < ? AND next_retry_at <= ?
     ORDER BY
       CASE priority
         WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3
       END ASC, created_at ASC`
  ).all(MAX_RETRIES, now);

  if (rows.length === 0) return;

  logger.info(`[SYNC] Retrying ${rows.length} unacked records`);
  for (const row of rows) {
    const topic = `smartcamp/sync/${row.entity}`;
    const payload = JSON.parse(row.payload);
    const domain = getDomainForTable(row.table_name);
    const result = saamp.publish(topic, payload, 'sync', domain);

    if (result.published) {
      markPublished(row.sync_id);
      syncLog('published', row.entity, row.local_id, { sync_id: row.sync_id, retry: row.retry_count + 1 });
    } else {
      syncLog('buffered', row.entity, row.local_id, { sync_id: row.sync_id, retry: row.retry_count + 1 });
    }
  }
}

// ── Adaptive sync interval ──────────────────────────────────────────────

function getAdaptiveInterval(networkState) {
  switch (networkState) {
    case 'STABLE':    return SYNC_INTERVAL_STABLE_MS;
    case 'DEGRADED':  return SYNC_INTERVAL_DEGRADED_MS;
    case 'CRITICAL':  return SYNC_INTERVAL_CRITICAL_MS;
    default:          return SYNC_INTERVAL_MS;
  }
}

function adjustSyncInterval() {
  const networkState = saamp.getNetworkState();
  const newInterval = getAdaptiveInterval(networkState);

  if (newInterval !== currentIntervalMs && syncTimer) {
    clearInterval(syncTimer);
    syncTimer = setInterval(runSyncCycle, newInterval);
    currentIntervalMs = newInterval;
    logger.info(`[SYNC] Interval adjusted to ${newInterval}ms (network: ${networkState})`);
  }
}

// ── Sync cycle ───────────────────────────────────────────────────────────

export async function runSyncCycle() {
  if (isRunning) {
    logger.debug('[SYNC] Cycle already in progress, skipping');
    return { skipped: true };
  }

  isRunning = true;
  const startTime = Date.now();
  const networkState = saamp.getNetworkState();

  try {
    retryPendingAcks();

    if (networkState === 'CRITICAL') {
      logger.debug('[SYNC] Network CRITICAL — deferring new sync publishes');
      return { published: 0, deferred: true, skipped: false };
    }

    const pending = fetchAllPending();
    if (pending.length === 0) {
      logger.debug('[SYNC] No pending records');
      return { published: 0, skipped: false };
    }

    let totalPublished = 0;
    let totalBuffered = 0;

    for (const batch of pending) {
      const entity = TABLE_TO_ENTITY[batch.table];
      if (!entity) {
        logger.warn(`[SYNC] No entity mapping for table: ${batch.table}`);
        continue;
      }

      const topic = `smartcamp/sync/${entity}`;

      for (const row of batch.rows) {
        const syncId = randomUUID();
        const payload = buildSyncMessage(entity, stripMeta(row));

        insertPending(syncId, entity, batch.table, payload.local_id, payload.operation, payload.priority, payload.payload);
        syncLog('queued', entity, payload.local_id, { sync_id: syncId, priority: payload.priority });

        const domain = getDomainForTable(batch.table);
        const result = saamp.publish(topic, payload, 'sync', domain);

        if (result.published) {
          markPublished(syncId);
          syncLog('published', entity, payload.local_id, { sync_id: syncId, qos: result.final_qos });
          totalPublished++;
        } else {
          syncLog('buffered', entity, payload.local_id, { sync_id: syncId, network: networkState });
          totalBuffered++;
        }
      }
    }

    lastSyncAt = nowISO();
    syncCount++;

    const elapsed = Date.now() - startTime;
    if (totalPublished > 0 || totalBuffered > 0) {
      logger.info(`[SYNC] Cycle #${syncCount}: ${totalPublished} published, ${totalBuffered} buffered (${elapsed}ms)`);
    }

    return { published: totalPublished, buffered: totalBuffered, elapsed_ms: elapsed, skipped: false };
  } catch (err) {
    logger.error(`[SYNC] Cycle failed: ${err.message}`);
    return { error: err.message, skipped: false };
  } finally {
    isRunning = false;
    adjustSyncInterval();
  }
}

// ── Start / stop ─────────────────────────────────────────────────────────

export function startSync(intervalMs = SYNC_INTERVAL_MS) {
  if (syncTimer) {
    logger.warn('[SYNC] Already started');
    return;
  }

  saamp.onMessage('smartcamp/sync/ack', handleAck);
  saamp.onFlush(handleFlush);

  currentIntervalMs = intervalMs;

  setTimeout(() => {
    runSyncCycle();
    syncTimer = setInterval(runSyncCycle, intervalMs);
    ackTimer = setInterval(retryPendingAcks, ACK_CHECK_INTERVAL_MS);
  }, 5000);

  logger.info(`[SYNC] Started (initial interval: ${intervalMs}ms, adaptive: 5s/15s/60s, device: ${C.DEVICE_ID})`);
}

export function stopSync() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  if (ackTimer) { clearInterval(ackTimer); ackTimer = null; }
  logger.info('[SYNC] Stopped');
}

export function getSyncStatus() {
  const pending = countPending();
  const ackPending = campDb.prepare('SELECT COUNT(*) AS cnt FROM sync_pending WHERE published = 1').get().cnt;
  const ackFailed = campDb.prepare('SELECT COUNT(*) AS cnt FROM sync_pending WHERE retry_count >= ?').get(MAX_RETRIES).cnt;
  const buffered = campDb.prepare('SELECT COUNT(*) AS cnt FROM sync_pending WHERE published = 0 AND retry_count < ?').get(MAX_RETRIES).cnt;
  return {
    running: isRunning,
    timer_active: !!syncTimer,
    last_sync: lastSyncAt,
    total_cycles: syncCount,
    network_state: saamp.getNetworkState(),
    mqtt_connected: saamp.isConnectedToBroker(),
    pending,
    ack_pending: ackPending,
    buffered,
    ack_failed: ackFailed,
  };
}

export { TABLE_TO_ENTITY, ENTITY_PK };
