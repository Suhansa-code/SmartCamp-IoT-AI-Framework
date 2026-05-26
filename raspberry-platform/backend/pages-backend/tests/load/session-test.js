import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 15,
  duration: '30s',
};

export default function () {
  // Pick a valid child_id between B-005 and B-454
  let idNumber = Math.floor(Math.random() * (454 - 5 + 1)) + 5; // random between 5 and 454
  let child_id = 'B-' + idNumber.toString().padStart(3, '0');   // ensures format like B-005

  let payload = JSON.stringify({
    child_id: child_id,
    condition_label: 'A'
  });

  let headers = { 'Content-Type': 'application/json' };

  let res = http.post('http://localhost:3001/api/session/start', payload, { headers });

  check(res, {
    'session start success': (r) => r.status === 200 || r.status === 201,
  });

  sleep(1);
}