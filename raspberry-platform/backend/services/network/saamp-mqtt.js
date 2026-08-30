import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { campDb } from '../../config/database.js';
import logger from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EMQX_HOST = process.env.EMQX_HOST || 'sa60a43c.ala.asia-southeast1.emqxsl.com';
const EMQX_PORT = process.env.EMQX_PORT || 8883;
const EMQX_USERNAME = process.env.EMQX_USERNAME || 'admin';
const EMQX_PASSWORD = process.env.EMQX_PASSWORD || 'admin@123';
const CA_CERT_PATH = process.env.EMQX_CA_CERT || path.join(__dirname, '../..', 'emqxsl-ca.crt');

const EMQX_URL = `mqtts://${EMQX_HOST}:${EMQX_PORT}`;
const CLIENT_ID = `smartcamp_pi_${Math.random().toString(16).slice(2, 8)}`;

// Worsening is applied on the first sample, recovery only after
// NETWORK_RECOVERY_SAMPLES consecutive better ones. Without that asymmetry a
// link sitting near a threshold flaps the buffer open and closed every cycle.
const STATE_SEVERITY = { STABLE: 0, DEGRADED: 1, CRITICAL: 2 };
const RECOVERY_SAMPLES = Number(process.env.NETWORK_RECOVERY_SAMPLES || 3);
// The monitor is a separate process. If it dies, a frozen prediction is worse
// than none, so past this age fall back to what the transport actually says.
const STATE_STALE_MS = Number(process.env.NETWORK_STATE_STALE_MS || 90_000);

let client = null;
let isConnected = false;
const messageHandlers = {};
const flushListeners = [];
let predictedNetworkState = 'STABLE';
let rawNetworkState = 'STABLE';
let improveRun = 0;
let lastStateUpdateMs = 0;

// QoS per priority, pushed by the monitor's model. Null until one arrives, and
// ignored once stale — the hand-written table below is always the fallback, so
// the publish path never depends on the model being alive.
let qosPolicy = null;
let lastPolicyUpdateMs = 0;

export function connect() {
  let ca;
  try { ca = fs.readFileSync(CA_CERT_PATH); } catch (e) {
    console.error('[MQTT] Failed to load CA cert:', e.message);
    ca = undefined;
  }

  client = mqtt.connect(EMQX_URL, {
    clientId: CLIENT_ID, username: EMQX_USERNAME, password: EMQX_PASSWORD,
    protocol: 'mqtts', rejectUnauthorized: ca ? true : false, ca,
    clean: true, reconnectPeriod: 2000, connectTimeout: 10000,
  });

  client.on('connect', () => {
    isConnected = true;
    console.log('[MQTT] Connected to EMQX broker');
    client.subscribe('smartcamp/#', { qos: 2 }, (err) => {
      if (err) console.error('[MQTT] Subscription failed:', err.message);
      else console.log('[MQTT] Subscribed to smartcamp/# (QoS 2)');
    });
    flushBuffer().catch((e) => console.error('[SAAMP] Flush failed on connect:', e.message));
    startBufferSweep();
  });

  client.on('message', (topic, messageBuffer) => {
    let payload;
    try {
      payload = JSON.parse(messageBuffer.toString());
    } catch { return; }
    const handler = messageHandlers[topic]
      || Object.entries(messageHandlers).find(([prefix]) => topic.startsWith(prefix + '/'))?.[1];
    if (handler) {
      try { handler(payload); } catch (e) {
        console.error('[MQTT] Handler error for', topic, e.message);
      }
    }
  });

  client.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
  client.on('close', () => { isConnected = false; });
  client.on('error', (err) => console.error('[MQTT] Error:', err.message));
}

// Base QoS for a caller-supplied priority, matching QOS_MAP in sync-priority.js.
export const PRIORITY_BASE_QOS = { LOW: 0, MEDIUM: 1, HIGH: 1, CRITICAL: 2 };

export function classifyMessage(source, action) {
  const rules = {
    // Registration is the only CRITICAL path: it is the one event that cannot
    // be reconstructed later, because everything downstream keys off the
    // person record existing. Check-in and verification are important but
    // replayable; distribution is routine operational data.
    'fingerprint_scanner|new_registration': { priority: 'CRITICAL', qos: 2 },
    'fingerprint_scanner|checkin': { priority: 'HIGH', qos: 1 },
    'fingerprint_scanner|verification': { priority: 'HIGH', qos: 1 },
    'wristband_scanner|distribution': { priority: 'MEDIUM', qos: 1 },
    'prediction_model|daily_forecast': { priority: 'HIGH', qos: 1 },
    'alert|disaster-alert': { priority: 'CRITICAL', qos: 2 },
    'sync|education': { priority: 'HIGH', qos: 1 },
    'sync|resources': { priority: 'HIGH', qos: 1 },
    'sync|disaster': { priority: 'CRITICAL', qos: 2 },
    'system|heartbeat': { priority: 'LOW', qos: 0 },
    'dashboard|status_poll': { priority: 'LOW', qos: 0 },
    'system|network_state': { priority: 'MEDIUM', qos: 1 },
  };
  const key = `${source}|${action}`;
  return rules[key] || { priority: 'MEDIUM', qos: 1 };
}

export function setNetworkState(state) {
  if (!(state in STATE_SEVERITY)) {
    console.warn(`[SAAMP] Ignoring unknown network state: ${state}`);
    return;
  }

  rawNetworkState = state;
  lastStateUpdateMs = Date.now();

  const prev = predictedNetworkState;

  if (STATE_SEVERITY[state] >= STATE_SEVERITY[prev]) {
    predictedNetworkState = state;
    improveRun = 0;
  } else if (++improveRun >= RECOVERY_SAMPLES) {
    predictedNetworkState = state;
    improveRun = 0;
  } else {
    console.log(`[SAAMP] Network improving (${state}) — ${improveRun}/${RECOVERY_SAMPLES} before leaving ${prev}`);
    return;
  }

  if (prev !== predictedNetworkState) {
    console.log(`[SAAMP] Network state ${prev} → ${predictedNetworkState}`);
  }

  // Leaving CRITICAL is the only moment buffered traffic becomes sendable;
  // nothing else drains the buffer while the socket stays up.
  if (prev === 'CRITICAL' && predictedNetworkState !== 'CRITICAL') {
    console.log('[SAAMP] Recovered from CRITICAL — flushing buffer');
    flushBuffer().catch((e) => console.error('[SAAMP] Recovery flush failed:', e.message));
  }
}

function isStateStale() {
  return lastStateUpdateMs === 0 || Date.now() - lastStateUpdateMs > STATE_STALE_MS;
}

export function getNetworkState() {
  if (isStateStale()) return isConnected ? 'STABLE' : 'CRITICAL';
  return predictedNetworkState;
}

export function setQosPolicy(policy) {
  if (!policy || typeof policy !== 'object') return;
  const clean = {};
  for (const [priority, qos] of Object.entries(policy)) {
    const q = Number(qos);
    // -1 means buffer; 0-2 are real QoS levels. Anything else is discarded
    // rather than trusted, since this arrives over HTTP from another process.
    if (Number.isInteger(q) && q >= -1 && q <= 2 && priority in PRIORITY_RANK) {
      clean[priority] = q;
    }
  }
  if (Object.keys(clean).length === 0) return;
  qosPolicy = clean;
  lastPolicyUpdateMs = Date.now();
  console.log(`[SAAMP] QoS policy updated: ${JSON.stringify(clean)}`);
}

/** Drop any model policy and fall back to the rule table until the next push. */
export function clearQosPolicy() {
  qosPolicy = null;
  lastPolicyUpdateMs = 0;
}

export function getQosPolicy() {
  if (!qosPolicy || Date.now() - lastPolicyUpdateMs > STATE_STALE_MS) return null;
  return qosPolicy;
}

export function getNetworkDiagnostics() {
  return {
    effective_state: getNetworkState(),
    predicted_state: predictedNetworkState,
    raw_state: rawNetworkState,
    stale: isStateStale(),
    recovery_progress: `${improveRun}/${RECOVERY_SAMPLES}`,
    last_update_ms_ago: lastStateUpdateMs ? Date.now() - lastStateUpdateMs : null,
    broker_connected: isConnected,
    qos_policy: getQosPolicy(),
    qos_source: getQosPolicy() ? 'model' : 'rules',
  };
}

export function decideAdaptiveQoS(priority, baseQos, networkState) {
  // Model-driven policy when one is current; the table below otherwise. The
  // fallback is the point — a dead monitor must degrade to known-good
  // behaviour rather than to no behaviour.
  const policy = getQosPolicy();
  if (policy && priority in policy) {
    const qos = policy[priority];
    if (qos === -1) return { qos: baseQos, action: 'buffer', source: 'model' };
    return { qos, action: 'publish', source: 'model' };
  }

  if (networkState === 'CRITICAL') {
    if (priority === 'CRITICAL') return { qos: 1, action: 'publish' };
    return { qos: baseQos, action: 'buffer' };
  }
  if (networkState === 'DEGRADED') {
    if (priority === 'LOW') return { qos: 1, action: 'publish' };
    if (priority === 'MEDIUM') return { qos: 1, action: 'publish' };
    if (priority === 'HIGH') return { qos: 2, action: 'publish' };
    if (priority === 'CRITICAL') return { qos: 2, action: 'publish' };
  }
  return { qos: baseQos, action: 'publish' };
}

// SQLite on an SD card is the constraint here: an outage must not be able to
// fill the disk, and stale low-value traffic is not worth replaying hours late.
const BUFFER_MAX_ROWS = Number(process.env.MQTT_BUFFER_MAX_ROWS || 5000);
const BUFFER_TTL_HOURS = Number(process.env.MQTT_BUFFER_TTL_HOURS || 24);
const FLUSHED_RETENTION_MIN = Number(process.env.MQTT_BUFFER_FLUSHED_RETENTION_MIN || 60);
const PRIORITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

// Least important first, oldest first within a priority — the eviction order.
const EVICTION_ORDER = `ORDER BY CASE priority
    WHEN 'LOW' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END ASC,
  created_at ASC`;

function makeRoomFor(priority) {
  const { c } = campDb.prepare('SELECT COUNT(*) AS c FROM mqtt_buffer WHERE flushed = 0').get();
  if (c < BUFFER_MAX_ROWS) return true;

  const victims = campDb
    .prepare(`SELECT id, priority FROM mqtt_buffer WHERE flushed = 0 ${EVICTION_ORDER} LIMIT ?`)
    .all(c - BUFFER_MAX_ROWS + 1);

  // Never evict something more important than the message asking for room —
  // drop the incoming one instead.
  const rank = PRIORITY_RANK[priority] ?? 1;
  if (victims.some((v) => (PRIORITY_RANK[v.priority] ?? 1) > rank)) {
    console.warn(`[SAAMP] Buffer full (${c}) — dropping incoming ${priority} message`);
    return false;
  }

  const del = campDb.prepare('DELETE FROM mqtt_buffer WHERE id = ?');
  for (const v of victims) del.run(v.id);
  console.warn(`[SAAMP] Buffer full (${c}) — evicted ${victims.length} low-priority message(s)`);
  return true;
}

function bufferMessage(topic, payload, priority, qos) {
  if (!makeRoomFor(priority)) return false;
  campDb.prepare('INSERT INTO mqtt_buffer (topic, payload, priority, qos) VALUES (?, ?, ?, ?)')
    .run(topic, JSON.stringify(payload), priority, qos);
  logger.debug(`[SAAMP] Buffered ${priority} message → ${topic}`);
  return true;
}

export function purgeBuffer() {
  const delivered = campDb.prepare(
    `DELETE FROM mqtt_buffer WHERE flushed = 1 AND created_at < datetime('now', ?)`
  ).run(`-${FLUSHED_RETENTION_MIN} minutes`).changes;

  const expired = campDb.prepare(
    `DELETE FROM mqtt_buffer WHERE flushed = 0 AND priority IN ('LOW', 'MEDIUM')
       AND created_at < datetime('now', ?)`
  ).run(`-${BUFFER_TTL_HOURS} hours`).changes;

  if (delivered || expired) {
    console.log(`[SAAMP] Buffer purge: ${delivered} delivered, ${expired} expired`);
  }
  return { delivered, expired };
}

// mqtt.js resolves the publish callback on PUBACK (QoS 1) / PUBCOMP (QoS 2),
// so it is the only signal that the broker actually took the message. If the
// link dies mid-flush the callback never fires, so cap the wait and leave the
// row buffered for the next attempt.
const ACK_TIMEOUT_MS = Number(process.env.MQTT_ACK_TIMEOUT_MS || 10000);
const FLUSH_BATCH_SIZE = Number(process.env.MQTT_FLUSH_BATCH_SIZE || 50);
const FLUSH_BATCH_PAUSE_MS = Number(process.env.MQTT_FLUSH_BATCH_PAUSE_MS || 250);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Messages reach the buffer for reasons that have nothing to do with network
// state — a per-person client failing to authenticate, a broker rejection, a
// transient publish error. Those have no recovery event: the shared client
// never reconnects and the state never leaves CRITICAL, so the only two flush
// triggers never fire and the rows sit there indefinitely.
const BUFFER_SWEEP_MS = Number(process.env.MQTT_BUFFER_SWEEP_MS || 30_000);
let sweepTimer = null;

export function startBufferSweep() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    if (!isConnected || isFlushing || getNetworkState() === 'CRITICAL') return;
    const { c } = campDb.prepare(
      'SELECT COUNT(*) AS c FROM mqtt_buffer WHERE flushed = 0'
    ).get();
    if (c === 0) return;
    console.log(`[SAAMP] Buffer sweep: ${c} message(s) still held, retrying`);
    flushBuffer().catch((e) => console.error('[SAAMP] Sweep flush failed:', e.message));
  }, BUFFER_SWEEP_MS);
  sweepTimer.unref?.();
}

export function stopBufferSweep() {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
}
let isFlushing = false;

function publishWithAck(topic, payload, qos) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err); else resolve();
    };
    const timer = setTimeout(
      () => finish(new Error(`ack timeout after ${ACK_TIMEOUT_MS}ms`)),
      ACK_TIMEOUT_MS
    );
    try {
      client.publish(topic, payload, { qos, retain: false }, finish);
    } catch (e) { finish(e); }
  });
}

async function flushBuffer() {
  // Rows stay flushed = 0 until their ack lands, so a concurrent flush would
  // re-select and re-publish the in-flight ones.
  if (!isConnected || isFlushing) return;
  isFlushing = true;

  const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const select = campDb.prepare(
    'SELECT * FROM mqtt_buffer WHERE flushed = 0 AND priority = ? ORDER BY created_at ASC LIMIT ?'
  );
  const markFlushed = campDb.prepare('UPDATE mqtt_buffer SET flushed = 1 WHERE id = ?');
  let flushed = 0;
  const flushedMessages = [];

  try {
    for (const priority of order) {
      // Drain in batches rather than one big burst: after an outage the buffer
      // can hold thousands of messages, and firing them all at a link that just
      // came back is a good way to knock it over again.
      for (;;) {
        const rows = select.all(priority, FLUSH_BATCH_SIZE);
        if (rows.length === 0) break;

        for (const row of rows) {
          if (!isConnected) {
            console.warn('[SAAMP] Flush aborted — broker disconnected, remaining messages stay buffered');
            return;
          }
          if (getNetworkState() === 'CRITICAL') {
            console.warn('[SAAMP] Flush paused — network went CRITICAL again');
            return;
          }
          try {
            await publishWithAck(row.topic, row.payload, row.qos);
          } catch (e) {
            // Stop here: the link is unhealthy, and marking anything else
            // delivered would lose it. Everything left keeps flushed = 0.
            console.error(`[SAAMP] Flush stalled on message ${row.id} (${row.priority}): ${e.message}`);
            return;
          }
          // Acknowledged by the broker — only now is it safe to mark delivered.
          markFlushed.run(row.id);
          flushedMessages.push({ topic: row.topic, payload: row.payload, priority: row.priority });
          flushed++;
        }

        if (rows.length < FLUSH_BATCH_SIZE) break;
        if (FLUSH_BATCH_PAUSE_MS > 0) await sleep(FLUSH_BATCH_PAUSE_MS);
      }
    }
  } finally {
    isFlushing = false;
    try { purgeBuffer(); } catch (e) { console.error('[SAAMP] Buffer purge failed:', e.message); }
    if (flushed > 0) {
      console.log(`[SAAMP] Flushed ${flushed} buffered messages in priority order`);
      for (const listener of flushListeners) {
        try { listener(flushedMessages); } catch (e) { console.error('[SAAMP] Flush listener error:', e.message); }
      }
    }
  }
}

export { flushBuffer };

export function onFlush(callback) {
  flushListeners.push(callback);
}

export async function publishAsClient(topic, payload, clientId, password, source, action) {
  const { priority, qos: baseQos } = classifyMessage(source, action);
  const networkState = getNetworkState();
  const decision = decideAdaptiveQoS(priority, baseQos, networkState);
  const meta = { priority, base_qos: baseQos, network_state: networkState, final_qos: decision.qos, client_id: clientId };

  if (decision.action === 'buffer') {
    bufferMessage(topic, payload, priority, decision.qos);
    return { ...meta, action: 'buffer', published: false };
  }

  return new Promise(resolve => {
    let ca;
    try { ca = fs.readFileSync(CA_CERT_PATH); } catch (_) {}

    const personClient = mqtt.connect(EMQX_URL, {
      clientId, username: clientId, password, clean: true,
      reconnectPeriod: 0, connectTimeout: 6000, protocol: 'mqtts',
      ...(ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }),
    });

    const timer = setTimeout(() => {
      personClient.end(true);
      bufferMessage(topic, payload, priority, decision.qos);
      resolve({ ...meta, action: 'buffer', published: false, error: 'connect_timeout' });
    }, 8000);

    personClient.once('connect', () => {
      clearTimeout(timer);
      personClient.publish(topic, JSON.stringify(payload), { qos: decision.qos, retain: false }, err => {
        personClient.end();
        if (err) {
          bufferMessage(topic, payload, priority, decision.qos);
          resolve({ ...meta, action: 'buffer', published: false, error: err.message });
        } else {
          resolve({ ...meta, action: 'publish', published: true });
        }
      });
    });

    personClient.once('error', err => {
      clearTimeout(timer);
      personClient.end(true);
      bufferMessage(topic, payload, priority, decision.qos);
      resolve({ ...meta, action: 'buffer', published: false, error: err.message });
    });
  });
}

/**
 * @param priorityOverride  Caller-computed priority, used in place of the
 *   (source, action) lookup. sync-priority.js classifies each row by its
 *   *content* — a flood alert and a routine inventory update live in the same
 *   table — and that judgement is lost if priority is re-derived here from the
 *   table's domain.
 */
export async function publish(topic, payload, source, action, priorityOverride) {
  let { priority, qos: baseQos } = classifyMessage(source, action);
  if (priorityOverride && priorityOverride in PRIORITY_BASE_QOS) {
    priority = priorityOverride;
    baseQos = PRIORITY_BASE_QOS[priority];
  }
  const networkState = getNetworkState();
  const decision = decideAdaptiveQoS(priority, baseQos, networkState);
  const meta = { priority, base_qos: baseQos, network_state: networkState, final_qos: decision.qos };

  if (decision.action === 'buffer' || !isConnected) {
    bufferMessage(topic, payload, priority, decision.qos);
    return { ...meta, action: 'buffer', published: false };
  }

  // mqtt.js reports delivery failures through the callback, never by throwing,
  // so a synchronous try/catch here would let failed messages vanish.
  try {
    await publishWithAck(topic, JSON.stringify(payload), decision.qos);
    logger.debug(`[SAAMP] Published ${priority} → ${topic} (QoS ${decision.qos}, Net ${networkState})`);
    return { ...meta, action: 'publish', published: true };
  } catch (e) {
    console.error(`[SAAMP] Publish failed (${e.message}) — buffering ${priority} → ${topic}`);
    bufferMessage(topic, payload, priority, decision.qos);
    return { ...meta, action: 'buffer', published: false, error: e.message };
  }
}

export function onMessage(topic, callback) {
  messageHandlers[topic] = callback;
}

export function isConnectedToBroker() {
  return isConnected;
}
