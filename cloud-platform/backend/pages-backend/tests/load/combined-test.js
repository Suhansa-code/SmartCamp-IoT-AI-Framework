import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 15,
  duration: '30s',
};

export default function () {
  let headers = { 'Content-Type': 'application/json' };

  // 1. Enrol child
  let enrolPayload = JSON.stringify({
    res_id: 'RES-' + __VU + '-' + __ITER,
    grade: Math.random() < 0.5 ? 3 : 4,
    language: 'si'
  });

  let enrolRes = http.post('http://localhost:3001/api/child/enrol', enrolPayload, { headers });
  check(enrolRes, { 'enrol success': (r) => r.status === 200 || r.status === 201 });

  let child_id = enrolRes.json('child_id');

  if (child_id) {
    // 2. Start session
    let sessionPayload = JSON.stringify({ child_id: child_id, condition_label: 'A' });
    let sessionRes = http.post('http://localhost:3001/api/session/start', sessionPayload, { headers });
    check(sessionRes, { 'session start success': (r) => r.status === 200 || r.status === 201 });

    let session_id = sessionRes.json('session_id');

    if (session_id) {
      // 3. Task complete
      let taskPayload = JSON.stringify({
        session_id: session_id,
        child_id: child_id,
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

      let taskRes = http.post('http://localhost:3001/api/session/task-complete', taskPayload, { headers });
      check(taskRes, { 'task complete success': (r) => r.status === 200 || r.status === 201 });
    }
  }

  sleep(1);
}