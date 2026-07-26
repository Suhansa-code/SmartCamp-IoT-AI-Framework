import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../config/database.js';
import C from '../config/constants.js';
import logger from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { getAlerts, resolveAlert } from '../services/alertService.js';
 
// ── POST /api/auth/admin/login ─────────────────────────────────────────────────
 
async function adminLogin(req, res, next) {
  try {
    const { username, password } = req.body;
 
    const admin = db.prepare(`
      SELECT admin_id, username, password FROM pages_admins WHERE username = ?
    `).get(username);
 
    if (!admin) {
      logger.warn(`[AUTH] Login failed — unknown user: ${username}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
 
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      logger.warn(`[AUTH] Login failed — bad password for: ${username}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
 
    const token = jwt.sign(
      { admin_id: admin.admin_id, username: admin.username, role: 'admin' },
      C.JWT_SECRET,
      { expiresIn: C.JWT_EXPIRES_IN }
    );
 
    logger.info(`[AUTH] Admin login: ${username}`);
 
    return res.json({
      success:    true,
      token,
      expires_in: C.JWT_EXPIRES_IN,
    });
 
  } catch (err) {
    next(err);
  }
}
 
// GET /api/dashboard/alerts
 
function getAdminAlerts(req, res, next) {
  try {
    const { status } = req.query;   // optional filter: pending | resolved
 
    // Validate filter param
    if (status && !['pending', 'resolved'].includes(status)) {
      return next(createError(400, 'status must be pending or resolved'));
    }
 
    const alerts      = getAlerts(status || undefined);
    const totalPending = db.prepare(`
      SELECT COUNT(*) AS cnt FROM pages_alerts WHERE status = 'pending'
    `).get().cnt;
 
    logger.info(`[DASHBOARD] Admin ${req.user.username} fetched alerts: ${alerts.length} returned`);
 
    return res.json({
      success:       true,
      alerts,
      total_pending: totalPending,
    });
 
  } catch (err) {
    next(err);
  }
}
 
// POST /api/dashboard/alert/:alertId/resolve 
 
function resolveAdminAlert(req, res, next) {
  try {
    const { alertId } = req.params;
    const { notes }   = req.body;
 
    const resolved = resolveAlert(alertId, notes);
 
    if (!resolved) {
      return next(createError(404, `Alert not found: ${alertId}`));
    }
 
    logger.info(
      `[DASHBOARD] Admin ${req.user.username} resolved alert ${alertId}`
    );
 
    return res.json({
      success: true,
      message: 'Alert marked as resolved',
    });
 
  } catch (err) {
    next(err);
  }
}
 
export { adminLogin, getAdminAlerts, resolveAdminAlert };
 