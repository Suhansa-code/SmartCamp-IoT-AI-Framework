import express from 'express';
import { getResourceOverview } from '../controllers/resources/campResource.controller.js';
import {
  getTodayRequirement,
  getDistributionPlan,
  simulateDistribution,
  getRateProvenance,
  reloadRateTable,
} from '../controllers/resources/distribution.controller.js';

const router = express.Router();

router.get('/overview', getResourceOverview);

// Distribution — food and drinking water only (Sri Lanka rate table model).
router.get('/distribution/today', getTodayRequirement);
router.get('/distribution/plan', getDistributionPlan);
router.post('/distribution/simulate', simulateDistribution);
router.get('/distribution/rates', getRateProvenance);
router.post('/distribution/rates/reload', reloadRateTable);

export default router;
