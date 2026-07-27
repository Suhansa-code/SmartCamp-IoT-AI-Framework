import * as statsService from '../../services/resource/stats.js';

export function getOverview(req, res) {
  const result = statsService.getOverview();
  res.json(result);
}

export function getDistributionHistory(req, res) {
  const days = Math.min(parseInt(req.query.days) || 7, 30);
  const result = statsService.getDistributionHistory(days);
  res.json(result);
}
