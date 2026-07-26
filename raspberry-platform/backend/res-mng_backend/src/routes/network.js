// Network state route — exposes SAAMP's predicted network state.
// In production: fed by the Random Forest network predictor model.
// For demo: can be set manually via POST to demonstrate adaptive QoS.

const express = require('express');
const router = express.Router();
const saamp = require('../../services/saampMqtt');
const { db } = require('../../db/database');

// Last metrics snapshot pushed by the Python monitor service
let lastMetrics = null;
let lastUpdatedAt = null;

// GET /api/network/state — what the frontend polls to show indicator
router.get('/state', (req, res) => {
  res.json({ state: saamp.getNetworkState() });
});

// GET /api/network/status — full status for the frontend dashboard
router.get('/status', (req, res) => {
  const buffered = db.prepare(
    'SELECT COUNT(*) as c FROM mqtt_buffer WHERE flushed = 0'
  ).get().c;

  res.json({
    state:        saamp.getNetworkState(),
    metrics:      lastMetrics,
    updated_at:   lastUpdatedAt,
    buffered_messages: buffered,
  });
});

// POST /api/network/state — for manual demo control or for the Python
// ML predictor to push its prediction in.
// Body: { state: "STABLE" | "DEGRADED" | "CRITICAL", metrics?: {...} }
router.post('/state', (req, res) => {
  const { state, metrics } = req.body;
  const valid = ['STABLE', 'DEGRADED', 'CRITICAL'];
  if (!valid.includes(state)) {
    return res.status(400).json({ error: 'Invalid state' });
  }
  saamp.setNetworkState(state);
  if (metrics) {
    lastMetrics = metrics;
    lastUpdatedAt = new Date().toISOString();
  } else {
    lastUpdatedAt = new Date().toISOString();
  }
  res.json({ ok: true, state });
});

// POST /api/network/flush — manually trigger buffer flush (for demo)
router.post('/flush', (req, res) => {
  saamp.flushBuffer();
  res.json({ ok: true });
});

module.exports = router;
