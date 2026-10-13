import * as networkService from '../../services/network/network.js';

export function getState(req, res) {
  res.json({ state: networkService.getNetworkState() });
}

export function getStatus(req, res) {
  res.json(networkService.getNetworkStatus());
}

export function setState(req, res) {
  const { state, metrics, qos_policy: qosPolicy } = req.body;
  const valid = ['STABLE', 'DEGRADED', 'CRITICAL'];
  if (!valid.includes(state)) return res.status(400).json({ error: 'Invalid state' });
  networkService.setNetworkState(state, metrics, qosPolicy);
  res.json({ ok: true, state });
}

/**
 * Server-Sent Events are a good fit here: measurements only travel from the
 * Pi to the browser, EventSource reconnects automatically, and it avoids a
 * second websocket protocol beside the MQTT transport.
 */
export function streamStatus(req, res) {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (payload) => res.write(`event: network\ndata: ${payload}\n\n`);
  send(JSON.stringify(networkService.getNetworkStatus()));
  const unsubscribe = networkService.subscribeToNetworkStatus(send);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
}

export async function testPublish(req, res) {
  const priority = (req.body?.priority || 'MEDIUM').toUpperCase();
  try {
    res.json(await networkService.testPublish(priority));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export function flush(req, res) {
  networkService.flushBuffer();
  res.json({ ok: true });
}
