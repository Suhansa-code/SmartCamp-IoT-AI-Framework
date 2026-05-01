import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 15,           // simulate 15 children
  duration: '30s',   // run for 30 seconds
};

export default function () {
  // Build payload for task completion
  let payload = JSON.stringify({
    session_id: '31f631c3-ef6a-4be0-99f9-bb5c4cd75dd4', // use a valid session ID
    child_id: 'B-001',                                  // must match a valid child in DB
    taskMetrics: {
      accuracyRate: 0.78,
      falseTapRate: 0.18,
      avgReactionTime: 520,
      reactionVariance: 145
    },
    passiveSignals: {
      idleTimeRatio: 0.12,
      rapidClickCount: 2,
      timeToFirstMs: 3200,
      completionRatio: 1.0
    }
  });

  let headers = { 'Content-Type': 'application/json' };

  let res = http.post('http://localhost:3001/api/session/task-complete', payload, { headers });

  check(res, {
    'task complete success': (r) => r.status === 200 || r.status === 201,
  });

  sleep(1);
}