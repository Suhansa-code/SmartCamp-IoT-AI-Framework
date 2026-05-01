import http from 'k6/http';
import { check, sleep } from 'k6';

// ----------------------
// Scenario Definitions
// ----------------------
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '1m', target: 500 },
      ],
    },
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2h',
    },
    spike: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 10 },
        { duration: '10s', target: 200 },
        { duration: '30s', target: 10 },
      ],
    },
    dbLoad: {
      executor: 'constant-vus',
      vus: 30,
      duration: '5m',
    },
  },
};

// ----------------------
// Workflow Function
// ----------------------
export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // 1. Enrol child
  const enrolPayload = JSON.stringify({
    res_id: 'RES-' + __VU + '-' + __ITER,
    grade: Math.random() < 0.5 ? 3 : 4,
    language: 'si',
  });

  const enrolRes = http.post('http://localhost:3001/api/child/enrol', enrolPayload, { headers });
  check(enrolRes, { 'enrol success': (r) => r.status === 200 || r.status === 201 });
  const child_id = enrolRes.json('child_id');

  if (child_id) {
    // 2. Start session
    const sessionPayload = JSON.stringify({ child_id: child_id, condition_label: 'A' });
    const sessionRes = http.post('http://localhost:3001/api/session/start', sessionPayload, { headers });
    check(sessionRes, { 'session start success': (r) => r.status === 200 || r.status === 201 });
    const session_id = sessionRes.json('session_id');

    if (session_id) {
      // 3. Task complete with randomized metrics
      const taskPayload = JSON.stringify({
        session_id: session_id,
        child_id: child_id,
        taskMetrics: {
          accuracyRate: Math.random().toFixed(2),
          falseTapRate: (Math.random() * 0.3).toFixed(2),
          avgReactionTime: Math.floor(Math.random() * 800) + 300,
          reactionVariance: Math.floor(Math.random() * 200) + 50,
        },
        passiveSignals: {
          idleTimeRatio: (Math.random() * 0.3).toFixed(2),
          rapidClickCount: Math.floor(Math.random() * 5),
          timeToFirstMs: Math.floor(Math.random() * 5000) + 1000,
          completionRatio: 1.0,
        },
      });

      const taskRes = http.post('http://localhost:3001/api/session/task-complete', taskPayload, { headers });
      check(taskRes, { 'task complete success': (r) => r.status === 200 || r.status === 201 });

      // 4. End session
      const endPayload = JSON.stringify({ session_id: session_id, child_id: child_id });
      const endRes = http.post('http://localhost:3001/api/session/complete', endPayload, { headers });
      check(endRes, { 'session complete success': (r) => r.status === 200 || r.status === 201 });
    }
  }

  sleep(1); // pacing between iterations
}