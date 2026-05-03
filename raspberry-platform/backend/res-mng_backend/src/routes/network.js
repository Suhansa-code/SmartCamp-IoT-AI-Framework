// Network state route — exposes SAAMP's predicted network state.
// In production: fed by the Random Forest network predictor model.
// For demo: can be set manually via POST to demonstrate adaptive QoS.

const express = require('express');
const router = express.Router();
const saamp = require('../../services/saampMqtt');

// GET /api/network/state — what the frontend polls to show indicator
router.get('/state', (req, res) => {
  res.json({ state: saamp.getNetworkState() });
});

// POST /api/network/state — for manual demo control or for the Python
// ML predictor to push its prediction in.
// Body: { state: "STABLE" | "DEGRADED" | "CRITICAL" }
router.post('/state', (req, res) => {
  const { state } = req.body;
  const valid = ['STABLE', 'DEGRADED', 'CRITICAL'];
  if (!valid.includes(state)) {
    return res.status(400).json({ error: 'Invalid state' });
  }
  saamp.setNetworkState(state);
  res.json({ ok: true, state });
});

// POST /api/network/flush — manually trigger buffer flush (for demo)
router.post('/flush', (req, res) => {
  saamp.flushBuffer();
  res.json({ ok: true });
});

module.exports = router;
