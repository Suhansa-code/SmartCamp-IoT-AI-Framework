// Network monitoring route — exposes NetworkMonitor state to the admin dashboard.

import express from 'express';

export default function networkRoutes(networkMonitor) {
  const router = express.Router();

  router.get('/metrics', (req, res) => {
    res.json({
      connected:     networkMonitor.connected,
      network_state: { network_state: networkMonitor.networkState },
      metrics:       networkMonitor.metrics,
      stats:         networkMonitor.deliveryStats,
      messages:      networkMonitor.messages?.slice(-50) || [],
      buffer:        networkMonitor.buffer  || [],
      history:       networkMonitor.history || [],
    });
  });

  router.get('/state', (req, res) => {
    res.json({ network_state: networkMonitor.networkState });
  });

  return router;
}
