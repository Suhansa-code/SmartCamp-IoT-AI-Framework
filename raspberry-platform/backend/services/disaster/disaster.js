import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllCampStatusOverrides } from './camp-status-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAMPS_PATH = path.join(__dirname, '..', '..', 'data', 'disaster', 'camps.json');

export function getCampsData() {
  const raw = fs.readFileSync(CAMPS_PATH, 'utf-8');
  const camps = JSON.parse(raw);
  // Apply cloud-assigned status overrides
  const overrides = getAllCampStatusOverrides();
  for (const camp of camps) {
    if (overrides[camp.id]) {
      camp.status = overrides[camp.id].status;
      camp.status_source = overrides[camp.id].source;
      camp.status_updated_at = overrides[camp.id].updated_at;
    }
  }
  return camps;
}

export function getCampById(id) {
  const camps = getCampsData();
  return camps.find(c => c.id === id) || null;
}

export function getModelMetrics() {
  const modelPath = path.join(__dirname, '..', '..', '..', '..', 'edge-gateway', 'prediction-models', 'comparison_results', 'model_comparison_summary.json');
  try {
    const raw = fs.readFileSync(modelPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [
      { model_name: 'xgboost_model', accuracy: 0.8242, precision: 0.3501, recall: 0.8926, f1: 0.503, roc_auc: 0.9272 },
      { model_name: 'random_forest_model', accuracy: 0.8002, precision: 0.3086, recall: 0.8108, f1: 0.4471, roc_auc: 0.8857 },
      { model_name: 'decision_tree_model', accuracy: 0.6973, precision: 0.2246, recall: 0.8309, f1: 0.3536, roc_auc: 0.8404 },
      { model_name: 'logistic_regression_model', accuracy: 0.7093, precision: 0.2064, recall: 0.6739, f1: 0.316, roc_auc: 0.7758 },
    ];
  }
}

export function getOverview() {
  const camps = getCampsData();
  const statusCounts = {};
  camps.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
  const totalDisplaced = camps.reduce((s, c) => s + c.displaced, 0);
  const totalCapacity = camps.reduce((s, c) => s + c.capacity, 0);
  const totalWorkers = camps.reduce((s, c) => s + c.workers, 0);
  const avgAid = Math.round(camps.reduce((s, c) => s + c.aid, 0) / camps.length);

  const models = getModelMetrics();
  const bestModel = models.reduce((a, b) => (a.roc_auc > b.roc_auc ? a : b));

  return {
    summary: {
      total_camps: camps.length, total_displaced: totalDisplaced,
      total_capacity: totalCapacity, occupancy_pct: Math.round((totalDisplaced / totalCapacity) * 100),
      total_workers: totalWorkers, avg_aid_coverage: avgAid,
      critical_count: statusCounts.critical || 0, high_count: statusCounts.high || 0,
      medium_count: statusCounts.medium || 0, stable_count: statusCounts.stable || 0,
      recovery_count: statusCounts.recovery || 0,
    },
    alert_level: statusCounts.critical > 0 ? 'CRITICAL' : statusCounts.high > 0 ? 'WARNING' : 'SAFE',
    best_model: { name: bestModel.model_name, roc_auc: bestModel.roc_auc, accuracy: bestModel.accuracy },
    updated_at: new Date().toISOString(),
  };
}

export function getCampIdentity(campId) {
  if (!campId) return { prefix: '', location: '', symbol: '' };
  const parts = campId.split('-');
  if (parts.length >= 3) {
    const prefix = parts.slice(0, 2).join('-');
    const location = parts.slice(2).join('-');
    const symbol = location.charAt(0).toUpperCase();
    return { prefix, location, symbol };
  }
  if (parts.length === 2) {
    return { prefix: parts[0], location: parts[1], symbol: parts[1].charAt(0).toUpperCase() };
  }
  return { prefix: campId, location: '', symbol: campId.charAt(0).toUpperCase() };
}
