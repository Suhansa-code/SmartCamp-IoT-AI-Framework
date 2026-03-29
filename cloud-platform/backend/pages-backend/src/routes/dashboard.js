'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/dashboardController');
const { requireAdmin }     = require('../middleware/auth');
const { validateAdminLogin } = require('../middleware/validate');

// POST /api/auth/admin/login  — public (issues the JWT)
router.post('/auth/admin/login', validateAdminLogin, ctrl.adminLogin);

// GET  /api/dashboard/alerts  — admin only
router.get('/alerts', requireAdmin, ctrl.getAdminAlerts);

// POST /api/dashboard/alert/:alertId/resolve  — admin only
router.post('/alert/:alertId/resolve', requireAdmin, ctrl.resolveAdminAlert);

module.exports = router;