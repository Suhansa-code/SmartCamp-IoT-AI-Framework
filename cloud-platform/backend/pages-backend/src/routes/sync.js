import express from 'express';
import * as ctrl from '../controllers/syncController.js';

const router = express.Router();

// POST /api/sync/trigger
router.post('/trigger', ctrl.triggerSync);

// GET /api/sync/status
router.get('/status', ctrl.getSyncStatus);

export default router;