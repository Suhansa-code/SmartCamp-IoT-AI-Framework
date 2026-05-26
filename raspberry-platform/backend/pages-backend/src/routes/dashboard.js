import express from 'express';
import * as ctrl from '../controllers/dashboardController.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateAdminLogin } from '../middleware/validate.js';

const router = express.Router();

// POST /api/auth/admin/login  — public (issues the JWT)
router.post('/auth/admin/login', validateAdminLogin, ctrl.adminLogin);

// GET  /api/dashboard/alerts  — admin only
router.get('/alerts', requireAdmin, ctrl.getAdminAlerts);

// POST /api/dashboard/alert/:alertId/resolve  — admin only
router.post('/alert/:alertId/resolve', requireAdmin, ctrl.resolveAdminAlert);

export default router;