import * as disasterService from '../../services/disaster/disaster.js';

export function getCamps(req, res) {
  const camps = disasterService.getCampsData();
  res.json({ camps, updated_at: new Date().toISOString() });
}

export function getCampById(req, res) {
  const camp = disasterService.getCampById(req.params.id);
  if (!camp) return res.status(404).json({ error: 'Camp not found' });
  res.json({ camp, updated_at: new Date().toISOString() });
}

export function getPredictionModels(req, res) {
  const models = disasterService.getModelMetrics();
  res.json({ models });
}

export function getOverview(req, res) {
  const result = disasterService.getOverview();
  res.json(result);
}
