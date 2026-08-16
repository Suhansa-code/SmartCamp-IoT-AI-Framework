/**
 * Network domain controllers — expose monitor state to the admin dashboard.
 */
export function getMetrics(monitor, _req, res) {
  res.json({
    connected: monitor.isConnected(),
    network_state: monitor.getNetworkState(),
    metrics: monitor.getMetrics(),
    stats: monitor.getDeliveryStats(),
    messages: monitor.getRecentMessages().slice(-50),
    buffer: monitor.getBuffer(),
    history: monitor.getHistory(100),
  });
}

export function getState(monitor, _req, res) {
  res.json({ network_state: monitor.getNetworkState() });
}