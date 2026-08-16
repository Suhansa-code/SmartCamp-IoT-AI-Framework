import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.ALERTS_DB_PATH = path.join(os.tmpdir(), `alerts-api-test-${process.pid}.db`);

const { initializeSchema, closeDatabase } = await import('../src/config/database.js');
const { createApp } = await import('../src/app.js');

// Minimal monitor stub exposing the contract the network router needs.
const monitor = {
  isConnected: () => true,
  getNetworkState: () => ({ network_state: 'GOOD', predicted_state: 'STABLE', connected: true }),
  getMetrics: () => ({ rtt_avg: 10 }),
  getDeliveryStats: () => ({ total_sent: 0, delivery_rate: 100 }),
  getRecentMessages: () => [],
  getBuffer: () => [],
  getHistory: () => [],
};

let baseUrl;
let server;

before(async () => {
  initializeSchema();
  const app = createApp({ monitor });
  server = app.listen(0);
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
  try {
    fs.unlinkSync(process.env.ALERTS_DB_PATH);
  } catch {
    // already cleaned
  }
  closeDatabase();
});

async function api(pathname, options = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, options);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

test('GET /api/health returns ok', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
});

test('GET /api/disaster/overview aggregates camp data', async () => {
  const { status, body } = await api('/api/disaster/overview');
  assert.equal(status, 200);
  assert.ok(body.camps.length > 0);
  assert.ok(body.total_displaced > 0);
});

test('GET /api/disaster/camps/:campId returns camp detail', async () => {
  const { status, body } = await api('/api/disaster/camps/galle');
  assert.equal(status, 200);
  assert.equal(body.id, 'galle');
  assert.ok(body.detail);
});

test('GET /api/disaster/camps/:campId returns 404 for unknown camp', async () => {
  const { status } = await api('/api/disaster/camps/nope');
  assert.equal(status, 404);
});

test('GET /api/resources/overview returns overview shape', async () => {
  const { status, body } = await api('/api/resources/overview');
  assert.equal(status, 200);
  assert.equal(body.source, 'cloud_mqtt');
  assert.ok(body.population);
});

test('GET /api/network/metrics returns monitor contract', async () => {
  const { status, body } = await api('/api/network/metrics');
  assert.equal(status, 200);
  assert.equal(body.network_state.network_state, 'GOOD');
  assert.ok(body.metrics);
});

test('alerts flow: create, list, resolve', async () => {
  // The alerts table has an FK to children, so sync the child first.
  await fetch(`${baseUrl}/api/alerts/sync/children`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      children: [
        { child_id: 'API-C-1', res_id: 'R-1', camp_id: 'CAMP-A', grade: 3, language: 'si', baseline_score: 60.0 },
      ],
    }),
  });

  const alertPayload = {
    alert_id: 'API-1',
    child_id: 'API-C-1',
    res_id: 'R-1',
    camp_id: 'CAMP-A',
    alert_type: 'composite_drop',
    trigger_detail: { score: 42 },
    triggered_at: new Date().toISOString(),
  };

  const createRes = await fetch(`${baseUrl}/api/alerts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(alertPayload),
  });
  assert.equal(createRes.status, 201);

  const listRes = await fetch(`${baseUrl}/api/alerts`);
  const listBody = await listRes.json();
  assert.equal(listBody.success, true);
  assert.ok(listBody.alerts.some((a) => a.alert_id === 'API-1'));

  const resolveRes = await fetch(`${baseUrl}/api/alerts/API-1/resolve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ notes: 'done' }),
  });
  const resolveBody = await resolveRes.json();
  assert.equal(resolveBody.success, true);
  assert.equal(resolveBody.status, 'resolved');
});

test('unknown route returns 404 JSON', async () => {
  const { status, body } = await api('/api/does-not-exist');
  assert.equal(status, 404);
  assert.equal(body.success, false);
});