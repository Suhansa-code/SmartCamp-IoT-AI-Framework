import express from 'express';
import * as ctrl from '../controllers/sessionController.js';
import {
  validateSessionStart,
  validateTaskPayload,
  validateSessionComplete,
} from '../middleware/validate.js';

const router = express.Router();

// POST /api/session/start
router.post('/start', validateSessionStart, ctrl.startSession);

// POST /api/session/task-complete
router.post('/task-complete', ctrl.taskComplete);

//Test tursoDB updates
router.post('/turso-test', ctrl.tursoDBupdatesample);

// POST /api/session/second-gate
router.post('/second-gate', validateTaskPayload, ctrl.secondGate);

// POST /api/session/complete
router.post('/complete', validateSessionComplete, ctrl.completeSession);

// GET /api/session/content/:childId
router.get('/content/:childId', ctrl.getContentSession);

// GET /api/session/recent/:childId
router.get('/recent/:childId', ctrl.getRecentSessions);

export default router;
