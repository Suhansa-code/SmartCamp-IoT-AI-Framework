/**
 * NFR-PERF-001: Gate decision < 5 seconds under normal load
 * NFR-PERF-002: Child-facing response < 3 seconds under 15 concurrent users
 *
 * Run: k6 run test1_gate_performance.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const gateDecisionTime = new Trend('gate_decision_time', true);
const successRate      = new Rate('success_rate');
const failedRequests   = new Counter('failed_requests');

// ── Test configuration ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    normal_load: {
      executor: 'constant-vus',
      vus: 15,
      duration: '2m',
      tags: { scenario: 'normal_load' },
    },
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '30s', target: 10 },
        { duration: '30s', target: 15 },
        { duration: '30s', target: 0 },
      ],
      startTime: '2m30s',
      tags: { scenario: 'ramp_up' },
    },
  },
  thresholds: {
    'gate_decision_time': ['p(95)<5000', 'p(99)<5000'],
    'http_req_duration{scenario:normal_load}': ['p(95)<3000'],
    'success_rate': ['rate>0.99'],
    'http_req_failed': ['rate<0.01'],
  },
};

// ── Base URL ──────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:5000';

// ── Test payload ──────────────────────────────────────────────────────────────
function buildPayload(vuId, iterNum) {
  return JSON.stringify({
    child_id: `TEST-CHILD-${vuId}`,
    session_id: `k6-session-${vuId}-${iterNum}-${Date.now()}`,
    attempt: 1,
    taskMetrics: {
      accuracyRate: 0.85,
      falseTapRate: 0.05,
      avgReactionTime: 400,
      reactionVariance: 80,
    },
    passiveSignals: {
      idleTimeRatio: 0.1,
      rapidClickCount: 1,
      timeToFirstMs: 350,
      completionRatio: 0.9,
    },
  });
}

// ── VU logic ──────────────────────────────────────────────────────────────────
export default function () {
  const vuId = __VU;
  const iterNum = __ITER;
  const startTime = Date.now();

  const res = http.post(
    `${BASE_URL}/api/session/task-complete`,
    buildPayload(vuId, iterNum),
    { headers: { 'Content-Type': 'application/json' }, timeout: '10s' }
  );

  const elapsed = Date.now() - startTime;
  gateDecisionTime.add(elapsed);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'gate_decision present': (r) => {
      try {
        return JSON.parse(r.body).gate_decision !== undefined;
      } catch {
        return false;
      }
    },
    'composite_score present': (r) => {
      try {
        return JSON.parse(r.body).composite_score !== undefined;
      } catch {
        return false;
      }
    },
    'response time under 5s': () => elapsed < 5000,
  });

  successRate.add(ok);
  if (!ok) failedRequests.add(1);

  sleep(1);
}

// ── Summary ───────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  return {
    'results/gate_performance_results.json': JSON.stringify(data, null, 2),
    stdout: `
=== NFR TEST RESULTS: Gate Decision Performance ===
NFR-PERF-001: Gate decision < 5s
  p95: ${data.metrics.gate_decision_time?.values?.['p(95)'] ?? 'N/A'} ms
NFR-PERF-002: Child screens < 3s under 15 concurrent users
  p95 under normal_load: ${data.metrics['http_req_duration{scenario:normal_load}']?.values?.['p(95)'] ?? 'N/A'} ms
Success rate: ${(data.metrics.success_rate?.values?.rate * 100).toFixed(1)}%
Total requests: ${data.metrics.http_reqs?.values?.count ?? 'N/A'}
Failed requests: ${data.metrics.failed_requests?.values?.count ?? 0}
`,
  };
}
