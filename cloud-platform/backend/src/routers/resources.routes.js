import express from 'express';
import { getResourceOverview } from '../controllers/resources/campResource.controller.js';
import {
  getTodayRequirement,
  getDistributionPlan,
  simulateDistribution,
  getRateProvenance,
  reloadRateTable,
} from '../controllers/resources/distribution.controller.js';
import {
  listDistributions,
  getSummary as getDistributionSummary,
  getByResourceType,
  getTimeline,
  getCampList,
  getResourceTypes,
} from '../controllers/distribution/distribution.controller.js';
import {
  getStockOutlook, getStockAlerts, getStockCamps, getAliasInfo, reloadAliases,
} from '../controllers/resources/stockRunout.controller.js';
import {
  listResources,
  getSummary as getResourceSummary,
  getUsageTimeline,
  getPredictions,
  getCategories,
} from '../controllers/resource/resource.controller.js';
import {
  listInventory, createInventoryItem, adjustInventoryItem, inventorySummary,
  inventoryCategories, inventoryUsageTimeline, inventoryPredictionDataset,
  saveInventoryPredictionSnapshot,
} from '../controllers/resources/inventory.controller.js';

const router = express.Router();

router.get('/overview', getResourceOverview);

// Neon inventory — accepts food only in kg and water in L/mL, then stores the
// forecast-compatible kg/L value alongside the staff-entered unit.
router.get('/inventory/items', listInventory);
router.post('/inventory/items', createInventoryItem);
router.post('/inventory/items/:id/adjust', adjustInventoryItem);
router.get('/inventory/summary', inventorySummary);
router.get('/inventory/categories', inventoryCategories);
router.get('/inventory/usage-timeline', inventoryUsageTimeline);
router.get('/inventory/prediction-dataset', inventoryPredictionDataset);
router.post('/inventory/prediction-snapshots', saveInventoryPredictionSnapshot);

// Distribution planning — food and drinking water only (Sri Lanka rate table model).
router.get('/distribution/today', getTodayRequirement);
router.get('/distribution/plan', getDistributionPlan);
router.post('/distribution/simulate', simulateDistribution);
router.get('/distribution/rates', getRateProvenance);
router.post('/distribution/rates/reload', reloadRateTable);

// Distribution records — live data from distributions table.
router.get('/distributions', listDistributions);
router.get('/distributions/summary', getDistributionSummary);
router.get('/distributions/by-resource', getByResourceType);
router.get('/distributions/timeline', getTimeline);
router.get('/distributions/camps', getCampList);
router.get('/distributions/resource-types', getResourceTypes);

// Stock runout — forecast-driven days of cover, runout and reorder dates.
router.get('/stock/outlook', getStockOutlook);
router.get('/stock/alerts', getStockAlerts);
router.get('/stock/camps', getStockCamps);
// Commodity standardisation — inspect the curated alias layer, and dry-run one
// name through it with ?name=Milk%20Powder before trusting a date to it.
router.get('/stock/aliases', getAliasInfo);
router.post('/stock/aliases/reload', reloadAliases);

// Resource inventory — live data from resources table.
router.get('/inventory', listResources);
router.get('/resource-summary', getResourceSummary);
router.get('/usage-timeline', getUsageTimeline);
router.get('/predictions', getPredictions);
router.get('/categories', getCategories);

export default router;
