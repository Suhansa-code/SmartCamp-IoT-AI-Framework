import * as predictionService from '../../services/resource/prediction.js';

export function getInputs(req, res) {
  const inputs = predictionService.computeInputs();
  res.json(inputs);
}

export async function getForecast(req, res) {
  const days = Math.min(parseInt(req.query.days) || 7, 14);
  try {
    const result = await predictionService.getForecast(days);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function getResults(req, res) {
  const result = predictionService.getLatestResult();
  res.json(result);
}

export function postResult(req, res) {
  const { request_id, forecasts, result } = req.body;
  if (!request_id) return res.status(400).json({ error: 'request_id required' });
  const ok = predictionService.saveResult(request_id, forecasts, result);
  if (!ok) return res.status(404).json({ error: 'Request not found' });
  res.json({ ok: true, request_id });
}
