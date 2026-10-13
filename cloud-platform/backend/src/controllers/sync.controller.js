import { listNetworkStatuses, listSyncEvents } from '../data/sync/sync.postgres.repository.js';

const PRIORITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

/** GET /api/sync/events — Pi messages received by cloud, most urgent first. */
export async function getSyncEvents(req, res) {
  try {
    const priority = req.query.priority?.toUpperCase();
    if (priority && !PRIORITIES.has(priority)) {
      return res.status(400).json({ error: 'priority must be CRITICAL, HIGH, MEDIUM, or LOW' });
    }
    const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
    const events = await listSyncEvents({ priority, campId: req.query.camp_id, limit });
    res.json({ data: events, count: events.length });
  } catch (error) {
    console.error('[Sync] getSyncEvents error:', error);
    res.status(500).json({ error: 'Failed to fetch sync events' });
  }
}

/** GET /api/sync/network-status — latest network observation from every Pi. */
export async function getNetworkStatuses(_req, res) {
  try {
    const data = await listNetworkStatuses();
    res.json({ data, count: data.length });
  } catch (error) {
    console.error('[Sync] getNetworkStatuses error:', error);
    res.status(500).json({ error: 'Failed to fetch network statuses' });
  }
}
