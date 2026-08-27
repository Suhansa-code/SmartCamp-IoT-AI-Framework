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
  listResources,
  getSummary as getResourceSummary,
  getUsageTimeline,
  getPredictions,
  getCategories,
} from '../controllers/resource/resource.controller.js';

const router = express.Router();

router.get('/overview', getResourceOverview);

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

// Resource inventory — live data from resources table.
router.get('/inventory', listResources);
router.get('/resource-summary', getResourceSummary);
router.get('/usage-timeline', getUsageTimeline);
router.get('/predictions', getPredictions);
router.get('/categories', getCategories);

export default router;
