/**
 * Disaster domain controllers — HTTP layer only.
 */
import {
  getDisasterCampById,
  getDisasterCampSummaries,
  getDisasterDashboardSummary,
  getDisasterMapNodes,
} from '../../data/disaster/camp.repository.js';
import { predictFloodForCamp } from '../../services/disaster/floodPrediction.service.js';
import { getWaterLevelHistoryForCamp } from '../../services/disaster/waterLevelHistory.service.js';
import { listDisasterAlerts, updateDisasterAlertStatus } from '../../data/disaster/alert.repository.js';

export async function getOverview(_req, res, next) {
  try {
    res.json(await getDisasterDashboardSummary());
  } catch (err) {
    next(err);
  }
}

export async function getCamps(_req, res, next) {
  try {
    res.json({ camps: await getDisasterCampSummaries() });
  } catch (err) {
    next(err);
  }
}

export async function getMapNodes(_req, res, next) {
  try {
    res.json({ nodes: await getDisasterMapNodes() });
  } catch (err) {
    next(err);
  }
}

export async function getCampById(req, res, next) {
  let camp;
  try {
    camp = await getDisasterCampById(req.params.campId);
  } catch (err) {
    return next(err);
  }

  if (!camp) {
    return res.status(404).json({
      error: 'Camp not found',
      campId: req.params.campId,
    });
  }

  try {
    const prediction = predictFloodForCamp(camp);
    return res.json({ ...camp, prediction });
  } catch (error) {
    return res.json({
      ...camp,
      prediction: null,
      prediction_error: error instanceof Error ? error.message : 'Failed to run flood prediction',
    });
  }
}

export async function predictCamp(req, res, next) {
  let camp;
  try {
    camp = await getDisasterCampById(req.params.campId);
  } catch (err) {
    return next(err);
  }

  if (!camp) {
    return res.status(404).json({ error: 'Camp not found', campId: req.params.campId });
  }

  try {
    const result = predictFloodForCamp(camp);
    return res.json({ prediction: result });
  } catch (err) {
    console.error('[FloodPrediction] Error for', req.params.campId, err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function getCampWaterLevelHistory(req, res, next) {
  let camp;
  try {
    camp = await getDisasterCampById(req.params.campId);
  } catch (err) {
    return next(err);
  }

  if (!camp) {
    return res.status(404).json({ error: 'Camp not found', campId: req.params.campId });
  }

  try {
    const hours = Number(req.query.hours || 8);
    const history = await getWaterLevelHistoryForCamp(camp, { hours });

    history.points.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({
      camp_id: camp.id,
      station: history.station,
      source: history.source,
      points: history.points,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to load water-level history',
      campId: req.params.campId,
    });
  }
}

export async function getDisasterAlerts(req, res, next) {
  try {
    res.json({ alerts: await listDisasterAlerts({ campId: req.query.camp, status: req.query.status }) });
  } catch (err) {
    next(err);
  }
}

export async function updateAlertStatus(req, res, next) {
  const status = String(req.body?.status || '').toUpperCase();
  if (!['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) return res.status(400).json({ error: 'Invalid alert status' });
  try {
    const alert = await updateDisasterAlertStatus(req.params.alertId, status);
    if (!alert) return res.status(404).json({ error: 'Disaster alert not found' });
    res.json({ alert });
  } catch (err) {
    next(err);
  }
}