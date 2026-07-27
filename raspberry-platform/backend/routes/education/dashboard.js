import express from 'express';
import { validateAdminLogin } from '../../middleware/validate.js';
import { requireAdmin } from '../../middleware/auth.js';
import { adminLogin, getDashboardStats, getChildDetails } from '../../controllers/education/dashboard.js';

const router = express.Router();

router.post('/auth/admin/login', validateAdminLogin, adminLogin);
router.get('/dashboard/stats', requireAdmin, getDashboardStats);
router.get('/dashboard/child/:childId', requireAdmin, getChildDetails);

export default router;
