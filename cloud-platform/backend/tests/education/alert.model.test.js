import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Use an isolated temp DB before the modules are imported.
const tempDb = path.join(os.tmpdir(), `alerts-test-${process.pid}.db`);
process.env.ALERTS_DB_PATH = tempDb;

const { initializeSchema, closeDatabase } = await import('../../src/config/database.js');
const alertModel = await import('../../src/models/education/alert.model.js');

test.before(() => {
  initializeSchema();
});

test.after(() => {
  try {
    fs.unlinkSync(tempDb);
  } catch {
    // already cleaned
  }
  closeDatabase();
});

function seedAlert(overrides = {}) {
  const childId = overrides.child_id || 'C-1';
  alertModel.syncChildren([
    { child_id: childId, res_id: 'R-1', camp_id: overrides.camp_id || 'CAMP-A', grade: 3, language: 'si', baseline_score: 60.0 },
  ]);
  return alertModel.upsertAlert({
    alert_id: 'A-100',
    child_id: 'C-1',
    res_id: 'R-1',
    camp_id: 'CAMP-A',
    alert_type: 'composite_drop',
    trigger_detail: { score: 40 },
    triggered_at: new Date().toISOString(),
    ...overrides,
  });
}

test('upsertAlert stores a new alert', () => {
  const result = seedAlert();
  assert.equal(result.success, true);
  assert.equal(result.alert_id, 'A-100');

  const alert = alertModel.getAlert('A-100');
  assert.equal(alert.alert_id, 'A-100');
  assert.equal(alert.camp_id, 'CAMP-A');
});

test('upsertAlert resets an existing alert to pending', () => {
  seedAlert();
  alertModel.resolveAlert('A-100', 'handled');

  // Re-send the same alert — should flip back to pending
  seedAlert();
  const alert = alertModel.getAlert('A-100');
  assert.equal(alert.status, 'pending');
});

test('resolveAlert marks an alert resolved with notes', () => {
  seedAlert({ alert_id: 'A-200' });
  const ok = alertModel.resolveAlert('A-200', 'reviewed by admin');
  assert.equal(ok, true);

  const alert = alertModel.getAlert('A-200');
  assert.equal(alert.status, 'resolved');
  assert.equal(alert.resolved_notes, 'reviewed by admin');
});

test('resolveAlert returns false for unknown alert', () => {
  assert.equal(alertModel.resolveAlert('DOES-NOT-EXIST'), false);
});

test('getAlerts filters by status', () => {
  seedAlert({ alert_id: 'A-300', child_id: 'C-2' });
  alertModel.resolveAlert('A-300');

  const pending = alertModel.getAlerts('pending');
  const resolved = alertModel.getAlerts('resolved');
  assert.ok(pending.every((a) => a.status === 'pending'));
  assert.ok(resolved.some((a) => a.alert_id === 'A-300'));
});

test('getAlerts filters by camp', () => {
  seedAlert({ alert_id: 'A-400', camp_id: 'CAMP-B' });
  const campA = alertModel.getAlerts(null, 'CAMP-A');
  const campB = alertModel.getAlerts(null, 'CAMP-B');

  assert.ok(campA.some((a) => a.alert_id === 'A-400') === false);
  assert.ok(campB.some((a) => a.alert_id === 'A-400'));
});

test('syncChildren upserts child records', () => {
  const count = alertModel.syncChildren([
    { child_id: 'C-100', res_id: 'R-9', camp_id: 'CAMP-A', grade: 3, language: 'si', baseline_score: 60.5 },
  ]);
  assert.equal(count, 1);
});

test('syncSessions upserts session records', () => {
  const count = alertModel.syncSessions([
    { session_id: 'S-100', child_id: 'C-100', composite_score: 70.2, anomaly_flagged: true, alert_triggered: true, created_at: new Date().toISOString() },
  ]);
  assert.equal(count, 1);
});