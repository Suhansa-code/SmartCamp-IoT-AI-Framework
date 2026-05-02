// SAAMP — Semantic-Aware Adaptive Message Prioritization
// This is the NOVELTY component. Three things together:
//   1. Source-Action Semantic Classification (SACS)
//   2. Predictive network-state aware QoS adjustment
//   3. Priority-ordered offline buffering on disconnect

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const { db } = require('../db/database');

// =============================================================
// CONFIG
// =============================================================
const EMQX_HOST = process.env.EMQX_HOST || 'i17140d1.ala.asia-southeast1.emqxsl.com';
const EMQX_PORT = process.env.EMQX_PORT || 8883;
const EMQX_USERNAME = process.env.EMQX_USERNAME || 'admin';
const EMQX_PASSWORD = process.env.EMQX_PASSWORD || 'public';
const CA_CERT_PATH = process.env.EMQX_CA_CERT || path.join(__dirname, '../../emqxsl-ca.crt');

const EMQX_URL = `mqtts://${EMQX_HOST}:${EMQX_PORT}`;
const CLIENT_ID = `smartcamp_pi_${Math.random().toString(16).slice(2, 8)}`;

// =============================================================
// MQTT CLIENT
// =============================================================
let client = null;
let isConnected = false;

function connect() {
  let ca;
  try {
    ca = fs.readFileSync(CA_CERT_PATH);
  } catch (e) {
    console.error('[MQTT] Failed to load CA cert:', e.message);
    ca = undefined;
  }

  client = mqtt.connect(EMQX_URL, {
    clientId: CLIENT_ID,
    username: EMQX_USERNAME,
    password: EMQX_PASSWORD,
    protocol: 'mqtts',
    rejectUnauthorized: ca ? true : false,
    ca: ca,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    isConnected = true;
    console.log('[MQTT] Connected to EMQX broker');

    // Subscribe to all SmartCamp topics so the admin client is always visible
    // in EMQX console and receives every message published by per-person clients.
    // This is also the data feed for the adaptive QoS research model.
    client.subscribe('smartcamp/#', { qos: 2 }, (err) => {
      if (err) {
        console.error('[MQTT] Subscription failed:', err.message);
      } else {
        console.log('[MQTT] Subscribed to smartcamp/# (QoS 2)');
      }
    });

    flushBuffer(); // Reconnection — flush in priority order
  });

  client.on('message', (topic, messageBuffer) => {
    try {
      const payload = JSON.parse(messageBuffer.toString());
      console.log(`[MQTT ▼] ${topic} | client: ${payload.person?.id ?? payload.person_id ?? '?'} | event: ${payload.event ?? '-'}`);
    } catch {
      console.log(`[MQTT ▼] ${topic} | (raw) ${messageBuffer.toString().slice(0, 80)}`);
    }
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  client.on('close', () => {
    isConnected = false;
    console.log('[MQTT] Connection closed');
  });

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });
}

// =============================================================
// ELEMENT 1 — SOURCE-ACTION SEMANTIC CLASSIFICATION (SACS)
// =============================================================
// Decides priority + base QoS automatically from semantics
// No manual configuration. This is novelty pillar #1.

function classifyMessage(source, action) {
  const rules = {
    // Registration is mission-critical
    'fingerprint_scanner|new_registration': { priority: 'CRITICAL', qos: 2 },
    'fingerprint_scanner|checkin':          { priority: 'CRITICAL', qos: 2 },

    // Distribution must not be lost (prevents fraud)
    'wristband_scanner|distribution':       { priority: 'CRITICAL', qos: 2 },

    // Predictions are important but tolerant of single loss
    'prediction_model|daily_forecast':      { priority: 'HIGH', qos: 1 },

    // Status pings are disposable
    'system|heartbeat':                     { priority: 'LOW', qos: 0 },
    'dashboard|status_poll':                { priority: 'LOW', qos: 0 },

    // Network state info
    'system|network_state':                 { priority: 'MEDIUM', qos: 1 },
  };

  const key = `${source}|${action}`;
  return rules[key] || { priority: 'MEDIUM', qos: 1 };
}

// =============================================================
// ELEMENT 2 — PREDICTIVE NETWORK STATE
// =============================================================
// In production: Random Forest model predicts 60s ahead.
// For backend integration: simple state holder updated by ML service.

let predictedNetworkState = 'STABLE'; // STABLE | DEGRADED | CRITICAL

function setNetworkState(state) {
  predictedNetworkState = state;
  console.log(`[SAAMP] Network state predicted: ${state}`);
}

function getNetworkState() {
  return predictedNetworkState;
}

// =============================================================
// ADAPTIVE QoS DECISION
// =============================================================
// Combines semantic priority + predicted network state
// to produce final QoS. This is the visible "magic" of SAAMP.

function decideAdaptiveQoS(priority, baseQos, networkState) {
  // CRITICAL network → buffer everything except CRITICAL
  if (networkState === 'CRITICAL') {
    if (priority === 'CRITICAL') return { qos: 2, action: 'publish' };
    return { qos: baseQos, action: 'buffer' };
  }

  // DEGRADED network → upgrade QoS to protect deliveries
  if (networkState === 'DEGRADED') {
    if (priority === 'LOW') return { qos: 1, action: 'publish' };
    if (priority === 'MEDIUM') return { qos: 1, action: 'publish' };
    if (priority === 'HIGH') return { qos: 2, action: 'publish' };
    if (priority === 'CRITICAL') return { qos: 2, action: 'publish' };
  }

  // STABLE — use semantic base QoS as-is
  return { qos: baseQos, action: 'publish' };
}

// =============================================================
// ELEMENT 3 — PRIORITY-ORDERED BUFFER
// =============================================================
// On reconnection, flushes CRITICAL → HIGH → MEDIUM → LOW
// Not chronologically, like normal MQTT clients do.

function bufferMessage(topic, payload, priority, qos) {
  db.prepare(`
    INSERT INTO mqtt_buffer (topic, payload, priority, qos)
    VALUES (?, ?, ?, ?)
  `).run(topic, JSON.stringify(payload), priority, qos);
  console.log(`[SAAMP] Buffered ${priority} message → ${topic}`);
}

function flushBuffer() {
  if (!isConnected) return;

  const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  let flushed = 0;

  for (const priority of order) {
    const rows = db.prepare(`
      SELECT * FROM mqtt_buffer
      WHERE flushed = 0 AND priority = ?
      ORDER BY created_at ASC
    `).all(priority);

    for (const row of rows) {
      try {
        client.publish(row.topic, row.payload, { qos: row.qos, retain: false });
        db.prepare('UPDATE mqtt_buffer SET flushed = 1 WHERE id = ?').run(row.id);
        flushed++;
      } catch (e) {
        console.error('[SAAMP] Flush error:', e.message);
      }
    }
  }

  if (flushed > 0) {
    console.log(`[SAAMP] Flushed ${flushed} buffered messages in priority order`);
  }
}

// =============================================================
// PUBLIC API — what routes call
// =============================================================

// publishAsClient — creates a dedicated per-person MQTT connection for each event.
// This is what makes EMQX show each camp resident as their own client, with their
// own QoS decisions tracked individually — core requirement for the adaptive QoS model.
//
// clientId / password come from the persons table (set at registration via emqxManager).
// The connection is one-shot: connect → publish → end.
async function publishAsClient(topic, payload, clientId, password, source, action) {
  const { priority, qos: baseQos } = classifyMessage(source, action)
  const networkState = getNetworkState()
  const decision     = decideAdaptiveQoS(priority, baseQos, networkState)

  const meta = { priority, base_qos: baseQos, network_state: networkState,
                 final_qos: decision.qos, client_id: clientId }

  // Network critical + non-CRITICAL message → buffer via main connection, skip per-client connect
  if (decision.action === 'buffer') {
    bufferMessage(topic, payload, priority, decision.qos)
    console.log(`[SAAMP] Buffered (${clientId}) ${priority} → ${topic} (Net ${networkState})`)
    return { ...meta, action: 'buffer', published: false }
  }

  return new Promise(resolve => {
    let ca
    try { ca = fs.readFileSync(CA_CERT_PATH) } catch (_) {}

    const personClient = mqtt.connect(EMQX_URL, {
      clientId,
      username:        clientId,   // EMQX user_id is used as username
      password,
      clean:           true,
      reconnectPeriod: 0,          // no auto-reconnect — one-shot only
      connectTimeout:  6000,
      protocol:        'mqtts',
      ...(ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }),
    })

    // Safety timeout — if broker unreachable, fall back to buffer
    const timer = setTimeout(() => {
      personClient.end(true)
      bufferMessage(topic, payload, priority, decision.qos)
      resolve({ ...meta, action: 'buffer', published: false, error: 'connect_timeout' })
    }, 8000)

    personClient.once('connect', () => {
      clearTimeout(timer)
      personClient.publish(topic, JSON.stringify(payload), { qos: decision.qos, retain: false }, err => {
        personClient.end()
        if (err) {
          bufferMessage(topic, payload, priority, decision.qos)
          resolve({ ...meta, action: 'buffer', published: false, error: err.message })
        } else {
          console.log(`[SAAMP] ${clientId} → ${topic} (QoS ${decision.qos}, Net ${networkState})`)
          resolve({ ...meta, action: 'publish', published: true })
        }
      })
    })

    personClient.once('error', err => {
      clearTimeout(timer)
      personClient.end(true)
      bufferMessage(topic, payload, priority, decision.qos)
      resolve({ ...meta, action: 'buffer', published: false, error: err.message })
    })
  })
}

function publish(topic, payload, source, action) {
  // Step 1: Semantic classification
  const { priority, qos: baseQos } = classifyMessage(source, action);

  // Step 2: Adaptive QoS decision (network-aware)
  const networkState = getNetworkState();
  const decision = decideAdaptiveQoS(priority, baseQos, networkState);

  // Step 3: Publish or buffer
  let published = false;

  if (decision.action === 'buffer' || !isConnected) {
    bufferMessage(topic, payload, priority, decision.qos);
  } else {
    try {
      client.publish(
        topic,
        JSON.stringify(payload),
        { qos: decision.qos, retain: false }
      );
      published = true;
      console.log(
        `[SAAMP] Published ${priority} → ${topic} (QoS ${decision.qos}, Net ${networkState})`
      );
    } catch (e) {
      console.error('[SAAMP] Publish failed, buffering:', e.message);
      bufferMessage(topic, payload, priority, decision.qos);
    }
  }

  return {
    priority,
    base_qos: baseQos,
    network_state: networkState,
    final_qos: decision.qos,
    action: decision.action,
    published,
  };
}

module.exports = {
  connect,
  publish,
  publishAsClient,
  setNetworkState,
  getNetworkState,
  flushBuffer,
};
