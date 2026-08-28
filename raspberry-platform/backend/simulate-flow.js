/**
 * Simulate 3 sessions for TEST-CHILD-000300 through the actual API flow.
 *
 * PREREQUISITE: Start the backend first in another terminal:
 *   cd raspberry-platform/backend && npm run dev
 *
 * Usage: node simulate-flow.js
 */
import axios from 'axios';

const BASE = 'http://localhost:5000/api';
const CHILD_ID = 'TEST-CHILD-000300';
const RES_ID = 'R-300';

const SESSIONS = [
  {
    session_num: 1,
    taskMetrics: { accuracyRate: 0.85, falseTapRate: 0.08, avgReactionTime: 350, reactionVariance: 120 },
    passiveSignals: { idleTimeRatio: 0.10, rapidClickCount: 2, timeToFirstMs: 450, completionRatio: 0.95 },
  },
  {
    session_num: 2,
    taskMetrics: { accuracyRate: 0.88, falseTapRate: 0.06, avgReactionTime: 320, reactionVariance: 100 },
    passiveSignals: { idleTimeRatio: 0.08, rapidClickCount: 1, timeToFirstMs: 420, completionRatio: 0.97 },
  },
  {
    session_num: 3,
    taskMetrics: { accuracyRate: 0.82, falseTapRate: 0.10, avgReactionTime: 380, reactionVariance: 150 },
    passiveSignals: { idleTimeRatio: 0.12, rapidClickCount: 3, timeToFirstMs: 480, completionRatio: 0.90 },
  },
];

async function checkServer() {
  try {
    const res = await axios.get(`${BASE.replace('/api', '')}/`, { timeout: 3000 });
    return true;
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return false;
    if (err.response) return true;
    return false;
  }
}

async function run() {
  console.log('=== Simulating PAGES Flow ===\n');

  const serverUp = await checkServer();
  if (!serverUp) {
    console.log('[FAIL] Backend not running at http://localhost:5000');
    console.log('       Start it first: cd raspberry-platform/backend && npm run dev');
    process.exit(1);
  }
  console.log('[OK] Backend is running\n');

  // Step 1: Enrol child (direct insert with custom ID)
  console.log('--- Step 1: Enrol Child ---');
  try {
    const { pagesDb } = await import('./config/database.js');
    const existing = pagesDb.prepare('SELECT child_id FROM pages_children WHERE child_id = ?').get(CHILD_ID);
    if (existing) {
      console.log(`  [OK] Child already exists: ${CHILD_ID}`);
    } else {
      pagesDb.prepare(`
        INSERT INTO pages_children (child_id, res_id, grade, camp_id, language, enrolled_at, baseline_score)
        VALUES (?, ?, ?, 'CAMP-TEST', 'si', datetime('now'), 60)
      `).run(CHILD_ID, RES_ID, 3);
      console.log(`  [OK] Child enrolled: ${CHILD_ID}`);
    }
  } catch (err) {
    console.log('  [FAIL] Enrol:', err.message);
    return;
  }

  // Step 2: Sessions
  for (const s of SESSIONS) {
    console.log(`\n--- Step 2.${s.session_num}: Session ${s.session_num} ---`);

    let sessionId;
    try {
      const res = await axios.post(`${BASE}/session/start`, {
        person_id: CHILD_ID,
        condition_label: 'A',
      });
      sessionId = res.data.session_id;
      console.log(`  [OK] Started: ${sessionId}`);
      console.log(`       Session#: ${res.data.session_number} | Baseline: ${res.data.baseline_score}`);
    } catch (err) {
      console.log('  [FAIL] Start:', err.response?.status || err.code, err.response?.data?.error || err.message);
      continue;
    }

    try {
      const res = await axios.post(`${BASE}/session/task-complete`, {
        child_id: CHILD_ID,
        session_id: sessionId,
        attempt: 1,
        taskMetrics: s.taskMetrics,
        passiveSignals: s.passiveSignals,
      });
      console.log(`  [OK] Task complete: composite=${res.data.composite_score} gate=${res.data.gate_decision}`);
    } catch (err) {
      console.log('  [FAIL] Task:', err.response?.status || err.code, err.response?.data?.error || err.message);
      continue;
    }

    try {
      const res = await axios.post(`${BASE}/session/complete`, {
        session_id: sessionId,
        child_id: CHILD_ID,
        cognitiveScore: 85,
        contentResponses: [],
      });
      console.log(`  [OK] Complete. New baseline: ${res.data.new_baseline}`);
    } catch (err) {
      console.log('  [FAIL] Complete:', err.response?.status || err.code, err.response?.data?.error || err.message);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // Verify
  console.log('\n--- Verification ---');
  try {
    const res = await axios.get(`${BASE}/child/${CHILD_ID}`);
    const c = res.data;
    console.log(`  Child: ${c.child_id} | sessions=${c.total_sessions} | baseline=${c.baseline_score}`);
  } catch (err) {
    console.log('  [WARN] Could not fetch child:', err.response?.data?.error || err.message);
  }

  try {
    const res = await axios.get(`${BASE}/session/recent/${CHILD_ID}`);
    console.log(`  Recent sessions: ${res.data.recent_sessions?.length || 0}`);
    for (const s of (res.data.recent_sessions || [])) {
      console.log(`    ${s.session_id} | ${s.session_date}`);
    }
  } catch (err) {
    console.log('  [WARN] Could not fetch recent sessions:', err.response?.data?.error || err.message);
  }

  console.log('\n=== Done ===');
  console.log(`Child ID: ${CHILD_ID}`);
  console.log('Check DB: raspberry-platform/backend/db/pages.db');
  console.log('All records have synced=0 — will sync when MQTT broker is reachable.');
}

run().catch(console.error);
