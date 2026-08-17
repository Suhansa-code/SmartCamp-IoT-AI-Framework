/**
 * Disaster domain controllers — HTTP layer only.
 */
import {
  getDisasterCampById,
  getDisasterCampSummaries,
  getDisasterDashboardSummary,
  getDisasterMapNodes,
} from '../../data/disaster/camps.data.js';
import { predictFloodForCamp } from '../../services/disaster/floodPrediction.service.js';
import { getWaterLevelHistoryForCamp } from '../../services/disaster/waterLevelHistory.service.js';

export function getOverview(_req, res) {
  res.json(getDisasterDashboardSummary());
}

export function getCamps(_req, res) {
  res.json({ camps: getDisasterCampSummaries() });
}

export function getMapNodes(_req, res) {
  res.json({ nodes: getDisasterMapNodes() });
}

export function getCampById(req, res) {
  const camp = getDisasterCampById(req.params.campId);

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

export function predictCamp(req, res) {
  const camp = getDisasterCampById(req.params.campId);

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

export async function getCampWaterLevelHistory(req, res) {
  const camp = getDisasterCampById(req.params.campId);

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