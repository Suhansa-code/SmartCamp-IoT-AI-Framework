import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Force the in-memory repository — HTTP tests must not depend on a live DB.
process.env.DB_ENABLED = 'false';

const { createApp } = await import('../src/app.js');

let baseUrl;
let server;

before(async () => {
  const app = createApp();
  server = app.listen(0);
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
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

test('GET /api/disaster/overview returns empty when DB disabled', async () => {
  const { status, body } = await api('/api/disaster/overview');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.camps));
  assert.equal(body.total_displaced, 0);
});

test('GET /api/disaster/camps/:campId returns 404 when DB disabled', async () => {
  const { status } = await api('/api/disaster/camps/galle');
  assert.equal(status, 404);
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
