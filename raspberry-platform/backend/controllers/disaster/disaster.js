import * as disasterService from '../../services/disaster/disaster.js';
import * as gpsService from '../../services/disaster/gps.js';
import { C } from '../../config/constants.js';

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

export async function getGpsLocation(req, res) {
  const gps = await gpsService.getGpsLocation();
  res.json(gps);
}

export function getCampIdentity(req, res) {
  const identity = disasterService.getCampIdentity(C.CAMP_ID);
  res.json({ camp_id: C.CAMP_ID, ...identity });
}
