import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 20,           // 20 virtual users
  duration: '30s',   // run for 30 seconds
};

export default function () {
  const res = http.get('http://localhost:3001/api/health');
  sleep(1);
}