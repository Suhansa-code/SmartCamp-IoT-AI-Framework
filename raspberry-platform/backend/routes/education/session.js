import express from 'express';
import { validateSessionStart, validateTaskPayload, validateSessionComplete } from '../../middleware/validate.js';
import {
  startSession, taskComplete, secondGate, completeSession,
  getRecentSessions, getContentSession,
} from '../../controllers/education/session.js';

const router = express.Router();

router.post('/start', validateSessionStart, startSession);
router.post('/task-complete', validateTaskPayload, taskComplete);
router.post('/second-gate', validateTaskPayload, secondGate);
router.post('/complete', validateSessionComplete, completeSession);
router.get('/recent/:childId', getRecentSessions);
router.get('/content/:childId', getContentSession);

export default router;
