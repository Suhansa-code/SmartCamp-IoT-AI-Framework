import * as saamp from './saamp-mqtt.js';
import { campDb as db } from '../../config/database.js';

let lastMetrics = null;
let lastUpdatedAt = null;

export function getNetworkState() {
  return saamp.getNetworkState();
}

export function getNetworkStatus() {
  const buffered = db.prepare('SELECT COUNT(*) as c FROM mqtt_buffer WHERE flushed = 0').get().c;
  return { state: saamp.getNetworkState(), metrics: lastMetrics, updated_at: lastUpdatedAt, buffered_messages: buffered };
}

export function setNetworkState(state, metrics) {
  saamp.setNetworkState(state);
  if (metrics) lastMetrics = metrics;
  lastUpdatedAt = new Date().toISOString();
}

export function flushBuffer() {
  saamp.flushBuffer();
}
