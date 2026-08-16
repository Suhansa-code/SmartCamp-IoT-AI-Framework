/**
 * Education domain controllers — HTTP layer only.
 */
import * as alertService from '../../services/education/alert.service.js';

export function listAlerts(req, res, next) {
  try {
    const { status, camp } = req.query;
    const { stats, alerts } = alertService.listAlerts({ status, camp });
    res.json({ success: true, stats, alerts });
  } catch (err) {
    next(err);
  }
}

export function getAlert(req, res, next) {
  try {
    const { alertId } = req.params;
    const alert = alertService.getAlertDetails(alertId);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    res.json({ success: true, alert });
  } catch (err) {
    next(err);
  }
}

export function resolveAlert(req, res, next) {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;

    const success = alertService.resolveAlert(alertId, notes);

    if (!success) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    res.json({
      success: true,
      message: `Alert ${alertId} resolved`,
      alert_id: alertId,
      status: 'resolved',
    });
  } catch (err) {
    next(err);
  }
}

export function getStats(_req, res, next) {
  try {
    const stats = alertService.getAlertStats();
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
}

export function receiveAlert(req, res, next) {
  try {
    const result = alertService.receiveAlert(req.body);
    res.status(201).json({ success: true, message: 'Alert received and stored', ...result });
  } catch (err) {
    next(err);
  }
}

export function syncChildren(req, res, next) {
  try {
    const { children = [] } = req.body;
    const result = alertService.syncChildren(children);
    res.json({ success: true, message: result.message, count: result.synced });
  } catch (err) {
    next(err);
  }
}

export function syncSessions(req, res, next) {
  try {
    const { sessions = [] } = req.body;
    const result = alertService.syncSessions(sessions);
    res.json({ success: true, message: result.message, count: result.synced });
  } catch (err) {
    next(err);
  }
}

/** Education Insights — list per-camp summaries. */
export function listEducationCamps(_req, res, next) {
  try {
    const camps = alertService.listCampSummaries();
    res.json({ success: true, camps });
  } catch (err) {
    next(err);
  }
}

/** Education Insights — full detail for a single camp. */
export function getEducationCamp(req, res, next) {
  try {
    const { campId } = req.params;
    const camp = alertService.getCampEducation(campId);

    if (!camp) {
      return res.status(404).json({ success: false, message: 'Camp not found' });
    }

    res.json({ success: true, camp });
  } catch (err) {
    next(err);
  }
}