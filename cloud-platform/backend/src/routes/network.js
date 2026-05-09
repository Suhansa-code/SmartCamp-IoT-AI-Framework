//  monitoring route — exposes Monitor state to the admin dashboard.

import express from 'express';

export default function Routes(Monitor) {
  const router = express.Router();

  router.get('/metrics', (req, res) => {
    res.json({
      connected:     Monitor.connected,
      _state: { _state: Monitor.State },
      metrics:       Monitor.metrics,
      stats:         Monitor.deliveryStats,
      messages:      Monitor.messages?.slice(-50) || [],
      buffer:        Monitor.buffer  || [],
      history:       Monitor.history || [],
    });
  });

  router.get('/state', (req, res) => {
    res.json({ _state: Monitor.State });
  });

  return router;
}
