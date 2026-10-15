import * as saamp from './saamp-mqtt.js';
import { getReachability } from './connectivity.js';
import { campDb as db } from '../../config/database.js';
import { randomUUID } from 'crypto';
import C from '../../config/constants.js';
import { getCampId } from '../../config/camp-id.js';

let lastMetrics = null;
let lastUpdatedAt = null;
const HISTORY_LIMIT = 120;
const statusListeners = new Set();
let statusHistory = [];

export function getNetworkState() {
  return saamp.getNetworkState();
}

// The order flushBuffer() actually drains in.
const FLUSH_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * Buffer contents grouped by priority, in flush order.
 *
 * A single total cannot show the thing that matters — that a CRITICAL message
 * leaves before a MEDIUM one regardless of which arrived first — so the UI
 * needs the breakdown, not just the count.
 */
function bufferByPriority() {
  const rows = db.prepare(
    `SELECT priority, COUNT(*) AS count, MIN(created_at) AS oldest_at
       FROM mqtt_buffer WHERE flushed = 0 GROUP BY priority`
  ).all();

  const counts = Object.fromEntries(rows.map((r) => [r.priority, r]));
  return FLUSH_ORDER.map((priority, index) => ({
    priority,
    flush_position: index + 1,
    count: counts[priority]?.count ?? 0,
    oldest_at: counts[priority]?.oldest_at ?? null,
  }));
}

// Deliberately no payload: these carry names, ages and medical notes, and
// this response is rendered in a browser that may be on screen in public.
// Topic and priority are enough to see what is held and in what order.
function bufferMessages(limit = 25) {
  return db.prepare(
    `SELECT id, topic, priority, qos, created_at
       FROM mqtt_buffer WHERE flushed = 0
      ORDER BY CASE priority
                 WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1
                 WHEN 'MEDIUM' THEN 2 ELSE 3 END ASC,
               created_at ASC
      LIMIT ?`
  ).all(limit);
}

export function getNetworkStatus() {
  const buffered = db.prepare('SELECT COUNT(*) as c FROM mqtt_buffer WHERE flushed = 0').get().c;
  return {
    state: saamp.getNetworkState(),
    metrics: lastMetrics,
    updated_at: lastUpdatedAt,
    buffered_messages: buffered,
    buffer_by_priority: bufferByPriority(),
    buffer_messages: bufferMessages(),
    diagnostics: saamp.getNetworkDiagnostics(),
    reachability: getReachability(),
    history: statusHistory,
  };
}

export function setNetworkState(state, metrics, qosPolicy) {
  saamp.setNetworkState(state);
  if (metrics) lastMetrics = metrics;
  if (qosPolicy) saamp.setQosPolicy(qosPolicy);
  lastUpdatedAt = new Date().toISOString();

  // Keep a compact, in-memory signal trail for the operator dashboard. This
  // is deliberately separate from mqtt_buffer: network observations are
  // transient diagnostics, not operational data that belongs on an SD card.
  const diagnostics = saamp.getNetworkDiagnostics();
  const sample = {
    at: lastUpdatedAt,
    state: diagnostics.effective_state,
    raw_state: diagnostics.raw_state,
    metrics: lastMetrics,
    qos_policy: diagnostics.qos_policy,
    qos_source: diagnostics.qos_source,
  };
  statusHistory = [...statusHistory, sample].slice(-HISTORY_LIMIT);
  notifyStatusListeners();
  publishNetworkStatus(sample).catch((error) => {
    console.error(`[NETWORK] Could not queue cloud status: ${error.message}`);
  });
}

async function publishNetworkStatus(sample) {
  const priority = sample.state === 'CRITICAL'
    ? 'CRITICAL'
    : sample.state === 'DEGRADED' ? 'HIGH' : 'LOW';
  const observedAt = sample.at;
  const payload = {
    sync_id: randomUUID(),
    entity: 'network-status',
    local_id: `${C.DEVICE_ID}:${observedAt}`,
    operation: 'UPSERT',
    priority,
    camp_id: getCampId(),
    device_id: C.DEVICE_ID,
    timestamp: observedAt,
    payload: {
      state: sample.state,
      raw_state: sample.raw_state,
      metrics: sample.metrics,
      qos_policy: sample.qos_policy,
      reachability: getReachability(),
      buffered_messages: db.prepare('SELECT COUNT(*) AS count FROM mqtt_buffer WHERE flushed = 0').get().count,
      observed_at: observedAt,
    },
  };
  await saamp.publish('smartcamp/sync/network-status', payload, 'system', 'network_state', priority);
}

/** Subscribe an SSE response to current and future monitor observations. */
export function subscribeToNetworkStatus(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function notifyStatusListeners() {
  const payload = JSON.stringify(getNetworkStatus());
  for (const listener of statusListeners) {
    try {
      listener(payload);
    } catch {
      // A socket can disappear between writes. The response's close handler
      // removes it; never let a dead dashboard affect SAAMP publishing.
    }
  }
}

// Priority -> a (source, action) pair that classifyMessage maps to it, so a
// caller can exercise one specific priority path.
const TEST_ROUTES = {
  CRITICAL: ['fingerprint_scanner', 'new_registration'],
  HIGH:     ['sync', 'resources'],
  MEDIUM:   ['system', 'network_state'],
  LOW:      ['system', 'heartbeat'],
};

/**
 * Publish a synthetic message and report what SAAMP decided to do with it.
 *
 * A real diagnostic, not only a demo aid: it is the only way to verify the
 * publish/buffer/flush path end to end in the field without waiting for live
 * traffic to happen to arrive at the right moment.
 */
export async function testPublish(priority = 'MEDIUM') {
  const route = TEST_ROUTES[priority];
  if (!route) throw new Error(`unknown priority: ${priority}`);

  const [source, action] = route;
  const result = await saamp.publish(
    'smartcamp/diagnostic/test',
    { test: true, priority, timestamp: new Date().toISOString() },
    source, action
  );
  return result;
}

export function flushBuffer() {
  // Fire-and-forget: a large flush must not hold the HTTP response open.
  saamp.flushBuffer().catch((e) => console.error('[SAAMP] Flush failed:', e.message));
}
