import { Router } from 'express';

export default function networkRoutes(networkMonitor) {
  const router = Router();

  router.get('/metrics', (req, res) => {
    const metrics = networkMonitor.getMetrics();
    const state = networkMonitor.getNetworkState();
    const messages = networkMonitor.getRecentMessages();
    const buffer = networkMonitor.getBuffer();
    const stats = networkMonitor.getDeliveryStats();
    const history = networkMonitor.getHistory();

    res.json({
      metrics,
      network_state: state,
      connected: networkMonitor.isConnected(),
      stats,
      messages,
      buffer,
      history
    });
  });

  router.get('/stats', (req, res) => {
    res.json(networkMonitor.getDeliveryStats());
  });

  router.get('/buffer', (req, res) => {
    res.json(networkMonitor.getBuffer());
  });

  router.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    res.json(networkMonitor.getHistory(limit));
  });

  router.post('/clear-buffer', (req, res) => {
    networkMonitor.clearBuffer();
    res.json({ success: true });
  });

  return router;
}
