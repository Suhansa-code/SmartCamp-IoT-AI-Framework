import { pagesDb } from '../../config/database.js';
import logger from '../../utils/logger.js';

export async function getEducationInsights(_req, res, next) {
  try {
    const totalChildren = pagesDb.prepare('SELECT COUNT(*) AS c FROM pages_children').get().c;
    const totalSessions = pagesDb.prepare('SELECT COUNT(*) AS c FROM pages_sessions').get().c;
    const completedSessions = pagesDb.prepare('SELECT COUNT(*) AS c FROM pages_sessions WHERE session_complete = 1').get().c;
    const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    const avgScores = pagesDb.prepare(`
      SELECT
        AVG(composite_score) AS avg_composite,
        AVG(task_score) AS avg_task,
        AVG(passive_score) AS avg_passive
      FROM pages_sessions WHERE session_complete = 1
    `).get();

    const gradeDist = pagesDb.prepare('SELECT grade, COUNT(*) AS count FROM pages_children GROUP BY grade ORDER BY grade').all();
    const alertDist = pagesDb.prepare('SELECT alert_status, COUNT(*) AS count FROM pages_children GROUP BY alert_status').all();
    const gateStats = pagesDb.prepare('SELECT gate_decision, COUNT(*) AS count FROM pages_sessions WHERE gate_decision IS NOT NULL GROUP BY gate_decision').all();

    const recentSessions = pagesDb.prepare(`
      SELECT s.session_id, s.child_id, s.composite_score, s.gate_decision, s.session_complete, s.created_at
      FROM pages_sessions s ORDER BY s.created_at DESC LIMIT 5
    `).all();

    const activeAlerts = pagesDb.prepare("SELECT COUNT(*) AS c FROM pages_alerts WHERE status = 'pending'").get().c;

    return res.json({
      total_children: totalChildren,
      total_sessions: totalSessions,
      completed_sessions: completedSessions,
      completion_rate: completionRate,
      active_alerts: activeAlerts,
      avg_composite: avgScores?.avg_composite ? Math.round(avgScores.avg_composite * 100) / 100 : null,
      avg_task: avgScores?.avg_task ? Math.round(avgScores.avg_task * 100) / 100 : null,
      avg_passive: avgScores?.avg_passive ? Math.round(avgScores.avg_passive * 100) / 100 : null,
      grade_distribution: gradeDist,
      alert_distribution: alertDist,
      gate_stats: gateStats,
      recent_sessions: recentSessions,
    });
  } catch (err) {
    logger.error(`[EDU-INSIGHTS] ${err.message}`);
    next(err);
  }
}
