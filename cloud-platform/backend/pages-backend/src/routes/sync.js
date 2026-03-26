'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/syncController');

// POST /api/sync/trigger
router.post('/trigger', ctrl.triggerSync);

// GET /api/sync/status
router.get('/status', ctrl.getSyncStatus);

module.exports = router;