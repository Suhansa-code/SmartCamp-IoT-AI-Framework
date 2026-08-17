import express from 'express';
import {
  listAlerts,
  getAlert,
  resolveAlert,
  getStats,
  receiveAlert,
  syncChildren,
  syncSessions,
  listEducationCamps,
  getEducationCamp,
} from '../controllers/education/alert.controller.js';

const router = express.Router();

router.get('/', listAlerts);
router.post('/', receiveAlert);
router.get('/stats/summary', getStats);
router.post('/sync/children', syncChildren);
router.post('/sync/sessions', syncSessions);
router.get('/education/camps', listEducationCamps);
router.get('/education/camps/:campId', getEducationCamp);
router.get('/:alertId', getAlert);
router.post('/:alertId/resolve', resolveAlert);

export default router;