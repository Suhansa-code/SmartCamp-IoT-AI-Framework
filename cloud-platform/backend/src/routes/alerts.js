import express from 'express';
import {
  getAlerts,
  getAlert,
  resolveAlert,
  upsertAlert,
  syncChildren,
  syncSessions
} from '../config/database.js';

const router = express.Router();

/**
 * GET /api/alerts
 * Fetch all alerts, optionally filtered by status and camp
 * Query params: ?status=pending&camp=CAMP-B
 */
router.get('/', (req, res, next) => {
  try {
    const { status, camp } = req.query;
    const alerts = getAlerts(status || null, camp || null);

    // Calculate summary stats
    const stats = {
      total: alerts.length,
      pending: alerts.filter(a => a.status === 'pending').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      by_type: alerts.reduce((acc, a) => {
        acc[a.alert_type] = (acc[a.alert_type] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      stats,
      alerts
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/alerts/:alertId
 * Fetch a specific alert with full details
 */
router.get('/:alertId', (req, res, next) => {
  try {
    const { alertId } = req.params;
    const alert = getAlert(alertId);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    res.json({ success: true, alert });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alerts/:alertId/resolve
 * Admin action: Resolve an alert
 * Body: { notes?: string }
 */
router.post('/:alertId/resolve', (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;

    const success = resolveAlert(alertId, notes || null);

    if (!success) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    res.json({
      success: true,
      message: `Alert ${alertId} resolved`,
      alert_id: alertId,
      status: 'resolved'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/alerts/stats/summary
 * Get alert statistics dashboard data
 */
router.get('/stats/summary', (req, res, next) => {
  try {
    const pending = getAlerts('pending');
    const resolved = getAlerts('resolved');

    const stats = {
      pending_count: pending.length,
      resolved_count: resolved.length,
      total_count: pending.length + resolved.length,
      by_type: {},
      by_camp: {},
      recent_30days: pending.filter(a => {
        const date = new Date(a.triggered_at);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return date >= thirtyDaysAgo;
      }).length
    };

    // Group by alert type
    [...pending, ...resolved].forEach(a => {
      stats.by_type[a.alert_type] = (stats.by_type[a.alert_type] || 0) + 1;
      stats.by_camp[a.camp_id] = (stats.by_camp[a.camp_id] || 0) + 1;
    });

    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alerts
 * Create or receive alert from raspberry platform
 * Body: { alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at }
 */
router.post('/', (req, res, next) => {
  try {
    const alertData = req.body;

    const result = upsertAlert(alertData);

    res.status(201).json({
      success: true,
      message: 'Alert received and stored',
      ...result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alerts/sync/children
 * Receive synced children data from raspberry platform
 * Body: { children: [...] }
 */
router.post('/sync/children', (req, res, next) => {
  try {
    const { children = [] } = req.body;

    if (!Array.isArray(children) || children.length === 0) {
      return res.json({ success: true, message: 'No children to sync' });
    }

    syncChildren(children);

    res.json({
      success: true,
      message: `Synced ${children.length} children`,
      count: children.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alerts/sync/sessions
 * Receive synced sessions data from raspberry platform
 * Body: { sessions: [...] }
 */
router.post('/sync/sessions', (req, res, next) => {
  try {
    const { sessions = [] } = req.body;

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return res.json({ success: true, message: 'No sessions to sync' });
    }

    syncSessions(sessions);

    res.json({
      success: true,
      message: `Synced ${sessions.length} sessions`,
      count: sessions.length
    });
  } catch (err) {
    next(err);
  }
});

export default router;
