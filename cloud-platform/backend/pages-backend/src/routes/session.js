'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/sessionController');
const {
  validateSessionStart,
  validateTaskPayload,
  validateSessionComplete,
} = require('../middleware/validate');

// POST /api/session/start
router.post('/start', validateSessionStart, ctrl.startSession);

// POST /api/session/task-complete
router.post('/task-complete', validateTaskPayload, ctrl.taskComplete);

// POST /api/session/second-gate
router.post('/second-gate', validateTaskPayload, ctrl.secondGate);

// POST /api/session/complete
router.post('/complete', validateSessionComplete, ctrl.completeSession);

// GET /api/session/content/:childId
router.get('/content/:childId', ctrl.getContentSession);

module.exports = router;