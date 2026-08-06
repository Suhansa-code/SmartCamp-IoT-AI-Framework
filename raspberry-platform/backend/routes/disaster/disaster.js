import express from 'express';
import { getCamps, getCampById, getPredictionModels, getOverview, getGpsLocation } from '../../controllers/disaster/disaster.js';

const router = express.Router();

router.get('/camps', getCamps);
router.get('/camps/:id', getCampById);
router.get('/prediction-models', getPredictionModels);
router.get('/overview', getOverview);
router.get('/gps', getGpsLocation);

export default router;
