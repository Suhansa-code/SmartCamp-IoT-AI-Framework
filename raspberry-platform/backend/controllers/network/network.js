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
