import express from 'express';
import * as ctrl from '../controllers/sessionController.js';
import {
  validateSessionStart,
  validateTaskPayload,
  validateSessionComplete,
} from '../middleware/validate.js';

const router = express.Router();

console.log('[ROUTES] Session routes loading...')

// POST /api/session/start
router.post('/start', validateSessionStart, ctrl.startSession);

// POST /api/session/task-complete
console.log('[ROUTES] Registering POST /api/session/task-complete')
router.post('/task-complete', validateTaskPayload, ctrl.taskComplete);
console.log('[ROUTES] Registered POST /api/session/task-complete')

//Test database update
router.post('/test-db-update', ctrl.testDBUpdate);

// POST /api/session/second-gate
router.post('/second-gate', validateTaskPayload, ctrl.secondGate);

// POST /api/session/complete
router.post('/complete', validateSessionComplete, ctrl.completeSession);

// GET /api/session/content/:childId
router.get('/content/:childId', ctrl.getContentSession);

// GET /api/session/recent/:childId
router.get('/recent/:childId', ctrl.getRecentSessions);

// DEBUG: GET /api/session/debug/signals/:sessionId
router.get('/debug/signals/:sessionId', ctrl.getSignalsDebug);

// DEBUG: POST /api/session/debug/test-signal-insert
router.post('/debug/test-signal-insert', ctrl.testSignalInsert);

// DEBUG: GET /api/session/debug/available-children
router.get('/debug/available-children', ctrl.getAvailableTestChildren);

export default router;
