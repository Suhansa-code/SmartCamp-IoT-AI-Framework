import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 15,           // simulate 15 children
  duration: '30s',   // run for 30 seconds
};

export default function () {
  // Only grade 3 or 4
  let grade = Math.random() < 0.5 ? 3 : 4;

  let payload = JSON.stringify({
    res_id: 'RES-' + __VU + '-' + __ITER,  // unique ID per request
    grade: grade,
    language: 'si'
  });

  let headers = { 'Content-Type': 'application/json' };

  let res = http.post('http://localhost:3001/api/child/enrol', payload, { headers });

  check(res, {
    'enrol success': (r) => r.status === 200 || r.status === 201,
  });

  sleep(1);
}