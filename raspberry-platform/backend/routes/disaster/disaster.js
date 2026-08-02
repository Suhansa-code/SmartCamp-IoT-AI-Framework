import express from 'express';
import { getCamps, getCampById, getPredictionModels, getOverview } from '../../controllers/disaster/disaster.js';

const router = express.Router();

router.get('/camps', getCamps);
router.get('/camps/:id', getCampById);
router.get('/prediction-models', getPredictionModels);
router.get('/overview', getOverview);

export default router;
