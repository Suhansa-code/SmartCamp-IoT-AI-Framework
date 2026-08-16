import express from 'express';
import { getOverview, getDistributionHistory } from '../../controllers/resource/stats.js';

const router = express.Router();

router.get('/overview', getOverview);
router.get('/distribution-history', getDistributionHistory);

export default router;
