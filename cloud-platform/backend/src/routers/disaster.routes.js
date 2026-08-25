import express from 'express';
import {
  getOverview,
  getCamps,
  getMapNodes,
  getCampById,
  predictCamp,
  getCampWaterLevelHistory,
  getDisasterAlerts,
  updateAlertStatus,
} from '../controllers/disaster/camp.controller.js';

const router = express.Router();

router.get('/overview', getOverview);
router.get('/alerts', getDisasterAlerts);
router.patch('/alerts/:alertId/status', updateAlertStatus);
router.get('/camps', getCamps);
router.get('/map-nodes', getMapNodes);
router.get('/camps/:campId', getCampById);
router.get('/camps/:campId/predict', predictCamp);
router.get('/camps/:campId/water-level-history', getCampWaterLevelHistory);

export default router;