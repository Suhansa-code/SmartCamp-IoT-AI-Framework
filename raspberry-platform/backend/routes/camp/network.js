import express from 'express';
import * as saamp from '../../services/saamp-mqtt.js';
import { campDb as db } from '../../config/database.js';

const router = express.Router();
let lastMetrics = null;
let lastUpdatedAt = null;

router.get('/state', (req, res) => {
  res.json({ state: saamp.getNetworkState() });
});

router.get('/status', (req, res) => {
  const buffered = db.prepare('SELECT COUNT(*) as c FROM mqtt_buffer WHERE flushed = 0').get().c;
  res.json({ state: saamp.getNetworkState(), metrics: lastMetrics, updated_at: lastUpdatedAt, buffered_messages: buffered });
});

router.post('/state', (req, res) => {
  const { state, metrics } = req.body;
  const valid = ['STABLE', 'DEGRADED', 'CRITICAL'];
  if (!valid.includes(state)) return res.status(400).json({ error: 'Invalid state' });
  saamp.setNetworkState(state);
  if (metrics) lastMetrics = metrics;
  lastUpdatedAt = new Date().toISOString();
  res.json({ ok: true, state });
});

router.post('/flush', (req, res) => {
  saamp.flushBuffer();
  res.json({ ok: true });
});

export default router;
