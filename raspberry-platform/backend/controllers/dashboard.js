import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pagesDb, sqliteRetrieve, sqliteGetLastChildId } from '../config/database.js';
import C from '../config/constants.js';
import logger from '../utils/logger.js';
import { createError } from '../middleware/error-handler.js';

export async function adminLogin(req, res, next) {
  try {
    const { username, password } = req.body;

    const admin = pagesDb.prepare('SELECT * FROM pages_admins WHERE username = ?').get(username);
    if (!admin) return next(createError(401, 'Invalid credentials'));

    const valid = bcrypt.compareSync(password, admin.password);
    if (!valid) return next(createError(401, 'Invalid credentials'));

    const token = jwt.sign({ admin_id: admin.admin_id, username }, C.JWT_SECRET, {
      expiresIn: C.JWT_EXPIRES_IN,
    });

    return res.json({ success: true, token, admin: { username: admin.username } });
  } catch (err) { next(err); }
}

export async function getDashboardStats(req, res, next) {
  try {
    const totalChildren = pagesDb.prepare('SELECT COUNT(*) AS c FROM pages_children').get().c;
    const totalSessions = pagesDb.prepare('SELECT COUNT(*) AS c FROM pages_sessions').get().c;
    const completedSessions = pagesDb.prepare('SELECT COUNT(*) AS c FROM pages_sessions WHERE session_complete = 1').get().c;
    const activeAlerts = pagesDb.prepare("SELECT COUNT(*) AS c FROM pages_alerts WHERE status = 'pending'").get().c;

    const gradeDist = pagesDb.prepare('SELECT grade, COUNT(*) AS c FROM pages_children GROUP BY grade').all();
    const langDist = pagesDb.prepare('SELECT language, COUNT(*) AS c FROM pages_children GROUP BY language').all();

    const avgComposite = pagesDb.prepare('SELECT AVG(composite_score) AS avg FROM pages_sessions WHERE composite_score IS NOT NULL').get();

    const recentSessions = pagesDb.prepare(`
      SELECT s.session_id, s.child_id, s.composite_score, s.gate_decision, s.session_complete, s.created_at
      FROM pages_sessions s ORDER BY s.created_at DESC LIMIT 10
    `).all();

    const childrenByAlert = pagesDb.prepare(`
      SELECT alert_status, COUNT(*) AS c FROM pages_children GROUP BY alert_status
    `).all();

    return res.json({
      success: true,
      stats: {
        total_children: totalChildren,
        total_sessions: totalSessions,
        completed_sessions: completedSessions,
        completion_rate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
        active_alerts: activeAlerts,
        avg_composite_score: avgComposite?.avg ? Math.round(avgComposite.avg * 100) / 100 : null,
        grade_distribution: gradeDist,
        language_distribution: langDist,
        children_by_alert: childrenByAlert,
      },
      recent_sessions: recentSessions,
    });
  } catch (err) { next(err); }
}

export async function getChildDetails(req, res, next) {
  try {
    const { childId } = req.params;
    const child = pagesDb.prepare(`
      SELECT * FROM pages_children WHERE child_id = ?
    `).get(childId);

    if (!child) return next(createError(404, `Child not found: ${childId}`));

    const sessions = pagesDb.prepare(`
      SELECT * FROM pages_sessions WHERE child_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(childId);

    const alerts = pagesDb.prepare(`
      SELECT * FROM pages_alerts WHERE child_id = ? ORDER BY triggered_at DESC LIMIT 10
    `).all(childId);

    return res.json({ success: true, child, sessions, alerts });
  } catch (err) { next(err); }
}
