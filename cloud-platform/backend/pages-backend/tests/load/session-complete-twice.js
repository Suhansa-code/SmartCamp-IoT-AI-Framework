import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 1, iterations: 1 };

export default function () {
  let headers = { 'Content-Type': 'application/json' };

  // First completion (should succeed)
  let payload = JSON.stringify({
    session_id: '31f631c3-ef6a-4be0-99f9-bb5c4cd75dd4',
    child_id: 'B-001'
  });

  let res1 = http.post('http://localhost:3001/api/session/complete', payload, { headers });
  check(res1, { 'first completion success': (r) => r.status === 200 || r.status === 201 });

  // Second completion (should fail)
  let res2 = http.post('http://localhost:3001/api/session/complete', payload, { headers });
  check(res2, { 'second completion fails': (r) => r.status === 400 || r.status === 409 });
}