import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 1, iterations: 1 };

export default function () {
  let headers = { 'Content-Type': 'application/json' };

  let payload = JSON.stringify({
    session_id: 'invalid-session-id',
    child_id: 'B-001'
  });

  let res = http.post('http://localhost:3001/api/session/complete', payload, { headers });

  check(res, {
    'invalid session returns 404': (r) => r.status === 404
  });
}