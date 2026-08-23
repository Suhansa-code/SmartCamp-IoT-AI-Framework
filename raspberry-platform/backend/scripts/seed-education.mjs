import { pagesDb, sqliteInsert } from '../config/database.js';
import { newId, nowISO } from '../utils/helpers.js';
import C from '../config/constants.js';

const childId = 'B-000001';
const sid1 = newId();
const sid2 = newId();
const alertId = newId();

pagesDb.transaction(() => {
  sqliteInsert('pages_sessions', {
    session_id: sid1, child_id: childId, content_session_id: 'SESSION-A',
    session_date: '2026-08-01', session_time: '10:30:00', condition_label: 'A',
    baseline_score_used: 60.0, composite_score: 65.0, task_score: 70.0,
    passive_score: 60.0, gate_decision: 'PASS', cognitive_score: 72.0,
    session_complete: 1, anomaly_flagged: 0, created_at: nowISO(),
  });

  sqliteInsert('pages_sessions', {
    session_id: sid2, child_id: childId, content_session_id: 'SESSION-B',
    session_date: '2026-08-02', session_time: '14:00:00', condition_label: 'A',
    baseline_score_used: 65.0, composite_score: 42.0, task_score: 40.0,
    passive_score: 45.0, gate_decision: 'FAIL_FIRST',
    session_complete: 0, anomaly_flagged: 1, created_at: nowISO(),
  });

  pagesDb.prepare('UPDATE pages_children SET total_sessions = 2, baseline_score = 65.0 WHERE child_id = ?').run(childId);

  sqliteInsert('pages_alerts', {
    alert_id: alertId, child_id: childId, camp_id: C.CAMP_ID,
    res_id: 'RES-001', alert_type: '3_of_5_flagged',
    trigger_detail: JSON.stringify({ trigger_session: sid2, recent_scores: [65, 42] }),
    triggered_at: nowISO(), status: 'pending',
  });

  pagesDb.prepare("UPDATE pages_children SET alert_status = 'active' WHERE child_id = ?").run(childId);
})();

console.log('Sessions + alert created for', childId);

const sessions = pagesDb.prepare('SELECT session_id, gate_decision, anomaly_flagged FROM pages_sessions WHERE child_id = ?').all(childId);
console.log('Sessions:', sessions.length);
const alerts = pagesDb.prepare('SELECT alert_id, alert_type, status FROM pages_alerts WHERE child_id = ?').all(childId);
console.log('Alerts:', alerts.length);
process.exit(0);
