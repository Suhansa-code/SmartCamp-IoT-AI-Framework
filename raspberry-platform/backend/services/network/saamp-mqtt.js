import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { campDb } from '../../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EMQX_HOST = process.env.EMQX_HOST || 'i17140d1.ala.asia-southeast1.emqxsl.com';
const EMQX_PORT = process.env.EMQX_PORT || 8883;
const EMQX_USERNAME = process.env.EMQX_USERNAME || 'admin';
const EMQX_PASSWORD = process.env.EMQX_PASSWORD || 'public';
const CA_CERT_PATH = process.env.EMQX_CA_CERT || path.join(__dirname, '../..', 'emqxsl-ca.crt');

const EMQX_URL = `mqtts://${EMQX_HOST}:${EMQX_PORT}`;
const CLIENT_ID = `smartcamp_pi_${Math.random().toString(16).slice(2, 8)}`;

let client = null;
let isConnected = false;
const messageHandlers = {};
const flushListeners = [];
let predictedNetworkState = 'STABLE';

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
    flushBuffer();
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

export function classifyMessage(source, action) {
  const rules = {
    'fingerprint_scanner|new_registration': { priority: 'CRITICAL', qos: 2 },
    'fingerprint_scanner|checkin': { priority: 'CRITICAL', qos: 2 },
    'fingerprint_scanner|verification': { priority: 'CRITICAL', qos: 2 },
    'wristband_scanner|distribution': { priority: 'CRITICAL', qos: 2 },
    'prediction_model|daily_forecast': { priority: 'HIGH', qos: 1 },
    'sync|education': { priority: 'HIGH', qos: 1 },
    'sync|resources': { priority: 'HIGH', qos: 1 },
    'system|heartbeat': { priority: 'LOW', qos: 0 },
    'dashboard|status_poll': { priority: 'LOW', qos: 0 },
    'system|network_state': { priority: 'MEDIUM', qos: 1 },
  };
  const key = `${source}|${action}`;
  return rules[key] || { priority: 'MEDIUM', qos: 1 };
}

export function setNetworkState(state) {
  predictedNetworkState = state;
  console.log(`[SAAMP] Network state predicted: ${state}`);
}

export function getNetworkState() {
  return predictedNetworkState;
}

export function decideAdaptiveQoS(priority, baseQos, networkState) {
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

function bufferMessage(topic, payload, priority, qos) {
  campDb.prepare('INSERT INTO mqtt_buffer (topic, payload, priority, qos) VALUES (?, ?, ?, ?)')
    .run(topic, JSON.stringify(payload), priority, qos);
  console.log(`[SAAMP] Buffered ${priority} message → ${topic}`);
}

function flushBuffer() {
  if (!isConnected) return;
  const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  let flushed = 0;
  const flushedMessages = [];
  for (const priority of order) {
    const rows = campDb.prepare(
      'SELECT * FROM mqtt_buffer WHERE flushed = 0 AND priority = ? ORDER BY created_at ASC'
    ).all(priority);
    for (const row of rows) {
      try {
        client.publish(row.topic, row.payload, { qos: row.qos, retain: false });
        campDb.prepare('UPDATE mqtt_buffer SET flushed = 1 WHERE id = ?').run(row.id);
        flushedMessages.push({ topic: row.topic, payload: row.payload, priority: row.priority });
        flushed++;
      } catch (e) { console.error('[SAAMP] Flush error:', e.message); }
    }
  }
  if (flushed > 0) {
    console.log(`[SAAMP] Flushed ${flushed} buffered messages in priority order`);
    for (const listener of flushListeners) {
      try { listener(flushedMessages); } catch (e) { console.error('[SAAMP] Flush listener error:', e.message); }
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

export function publish(topic, payload, source, action) {
  const { priority, qos: baseQos } = classifyMessage(source, action);
  const networkState = getNetworkState();
  const decision = decideAdaptiveQoS(priority, baseQos, networkState);
  let published = false;

  if (decision.action === 'buffer' || !isConnected) {
    bufferMessage(topic, payload, priority, decision.qos);
  } else {
    try {
      client.publish(topic, JSON.stringify(payload), { qos: decision.qos, retain: false });
      published = true;
      console.log(`[SAAMP] Published ${priority} → ${topic} (QoS ${decision.qos}, Net ${networkState})`);
    } catch (e) {
      console.error('[SAAMP] Publish failed, buffering:', e.message);
      bufferMessage(topic, payload, priority, decision.qos);
    }
  }

  return { priority, base_qos: baseQos, network_state: networkState, final_qos: decision.qos, action: decision.action, published };
}

export function onMessage(topic, callback) {
  messageHandlers[topic] = callback;
}

export function isConnectedToBroker() {
  return isConnected;
}
