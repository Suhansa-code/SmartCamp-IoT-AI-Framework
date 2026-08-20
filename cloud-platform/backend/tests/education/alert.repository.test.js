import { test } from 'node:test';
import assert from 'node:assert/strict';

// Force the in-memory repository — tests must not depend on a live DB.
process.env.DB_ENABLED = 'false';

// The repository is seeded from the data layer — no DB setup.
const alertRepo = await import('../../src/repositories/education/alert.repository.js');

async function seedAlert(overrides = {}) {
  const childId = overrides.child_id || 'C-1';
  await alertRepo.syncChildren([
    { child_id: childId, res_id: 'R-1', camp_id: overrides.camp_id || 'CAMP-A', grade: 3, language: 'si', baseline_score: 60.0 },
  ]);
  return alertRepo.upsertAlert({
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

test('upsertAlert stores a new alert', async () => {
  const result = await seedAlert();
  assert.equal(result.success, true);
  assert.equal(result.alert_id, 'A-100');

  const alert = await alertRepo.getAlert('A-100');
  assert.equal(alert.alert_id, 'A-100');
  assert.equal(alert.camp_id, 'CAMP-A');
});

test('upsertAlert resets an existing alert to pending', async () => {
  await seedAlert();
  await alertRepo.resolveAlert('A-100', 'handled');

  // Re-send the same alert — should flip back to pending
  await seedAlert();
  const alert = await alertRepo.getAlert('A-100');
  assert.equal(alert.status, 'pending');
});

test('resolveAlert marks an alert resolved with notes', async () => {
  await seedAlert({ alert_id: 'A-200' });
  const ok = await alertRepo.resolveAlert('A-200', 'reviewed by admin');
  assert.equal(ok, true);

  const alert = await alertRepo.getAlert('A-200');
  assert.equal(alert.status, 'resolved');
  assert.equal(alert.resolved_notes, 'reviewed by admin');
});

test('resolveAlert returns false for unknown alert', async () => {
  assert.equal(await alertRepo.resolveAlert('DOES-NOT-EXIST'), false);
});

test('getAlerts filters by status', async () => {
  await seedAlert({ alert_id: 'A-300', child_id: 'C-2' });
  await alertRepo.resolveAlert('A-300');

  const pending = await alertRepo.getAlerts('pending');
  const resolved = await alertRepo.getAlerts('resolved');
  assert.ok(pending.every((a) => a.status === 'pending'));
  assert.ok(resolved.some((a) => a.alert_id === 'A-300'));
});

test('getAlerts filters by camp', async () => {
  await seedAlert({ alert_id: 'A-400', camp_id: 'CAMP-B' });
  const campA = await alertRepo.getAlerts(null, 'CAMP-A');
  const campB = await alertRepo.getAlerts(null, 'CAMP-B');

  assert.ok(campA.some((a) => a.alert_id === 'A-400') === false);
  assert.ok(campB.some((a) => a.alert_id === 'A-400'));
});

test('syncChildren upserts child records', async () => {
  const count = await alertRepo.syncChildren([
    { child_id: 'C-100', res_id: 'R-9', camp_id: 'CAMP-A', grade: 3, language: 'si', baseline_score: 60.5 },
  ]);
  assert.equal(count, 1);
});

test('syncSessions upserts session records', async () => {
  const count = await alertRepo.syncSessions([
    { session_id: 'S-100', child_id: 'C-100', composite_score: 70.2, anomaly_flagged: true, alert_triggered: true, created_at: new Date().toISOString() },
  ]);
  assert.equal(count, 1);
});

test('getCampSummaries aggregates children, sessions and alerts per camp', async () => {
  await alertRepo.syncChildren([
    { child_id: 'C-200', res_id: 'R-2', camp_id: 'CAMP-EDU', grade: 3, language: 'si', baseline_score: 60.0 },
    { child_id: 'C-201', res_id: 'R-2', camp_id: 'CAMP-EDU', grade: 4, language: 'ta', baseline_score: 62.0 },
  ]);
  await alertRepo.syncSessions([
    { session_id: 'S-200', child_id: 'C-200', composite_score: 70, anomaly_flagged: false, alert_triggered: false, created_at: '2026-08-01T10:00:00Z' },
    { session_id: 'S-201', child_id: 'C-201', composite_score: 50, anomaly_flagged: true, alert_triggered: true, created_at: '2026-08-02T10:00:00Z' },
  ]);
  await alertRepo.upsertAlert({
    alert_id: 'A-EDU-1', child_id: 'C-200', res_id: 'R-2', camp_id: 'CAMP-EDU',
    alert_type: 'composite_drop', trigger_detail: { score: 40 }, triggered_at: new Date().toISOString(),
  });

  const summaries = await alertRepo.getCampSummaries();
  const edu = summaries.find((c) => c.id === 'CAMP-EDU');

  assert.ok(edu, 'camp summary should exist');
  assert.equal(edu.children, 2);
  assert.equal(edu.sessions, 2);
  assert.equal(edu.avg_composite, 60);
  assert.equal(edu.flagged_sessions, 1);
  assert.equal(edu.total_alerts, 1);
  assert.equal(edu.pending_alerts, 1);
  assert.equal(edu.grade_distribution.length, 2);
});

test('getCampSummaries does not double-count across the session/alert joins', async () => {
  await alertRepo.syncChildren([
    { child_id: 'C-300', res_id: 'R-3', camp_id: 'CAMP-MULTI', grade: 3, language: 'si', baseline_score: 60.0 },
    { child_id: 'C-301', res_id: 'R-3', camp_id: 'CAMP-MULTI', grade: 3, language: 'ta', baseline_score: 58.0 },
  ]);
  await alertRepo.syncSessions([
    { session_id: 'S-300', child_id: 'C-300', composite_score: 70, anomaly_flagged: false, alert_triggered: false, created_at: '2026-08-01T10:00:00Z' },
    { session_id: 'S-301', child_id: 'C-300', composite_score: 40, anomaly_flagged: true, alert_triggered: true, created_at: '2026-08-02T10:00:00Z' },
    { session_id: 'S-302', child_id: 'C-301', composite_score: 55, anomaly_flagged: false, alert_triggered: false, created_at: '2026-08-02T11:00:00Z' },
  ]);
  await alertRepo.upsertAlert({
    alert_id: 'A-MULTI-1', child_id: 'C-300', res_id: 'R-3', camp_id: 'CAMP-MULTI',
    alert_type: 'composite_drop', trigger_detail: { score: 40 }, triggered_at: new Date().toISOString(),
  });
  await alertRepo.resolveAlert('A-MULTI-1', 'resolved');

  const edu = (await alertRepo.getCampSummaries()).find((c) => c.id === 'CAMP-MULTI');

  assert.ok(edu, 'camp summary should exist');
  assert.equal(edu.children, 2);
  assert.equal(edu.sessions, 3, 'sessions must not be multiplied by the alert join');
  assert.equal(edu.flagged_sessions, 1);
  assert.equal(edu.total_alerts, 1, 'alerts must not be multiplied by the session join');
  assert.equal(edu.pending_alerts, 0);
  assert.equal(edu.avg_composite, 55, 'avg must not be skewed by duplicated join rows');
});

test('getCampEducation returns children, sessions, alerts and aggregates', async () => {
  const detail = await alertRepo.getCampEducation('CAMP-EDU');

  assert.ok(detail, 'camp detail should exist');
  assert.equal(detail.id, 'CAMP-EDU');
  assert.equal(detail.children_count, 2);
  assert.equal(detail.sessions_count, 2);
  assert.equal(detail.avg_composite, 60);
  assert.equal(detail.pending_alerts, 1);
  assert.equal(detail.children.length, 2);
  assert.ok(detail.children.every((c) => Array.isArray(c.recent_scores)));
  assert.equal(detail.alerts.length, 1);
  assert.equal(detail.alerts[0].trigger_detail.score, 40);
  assert.equal(detail.language_distribution.length, 2);
});

test('getCampEducation returns null for a camp with no children', async () => {
  assert.equal(await alertRepo.getCampEducation('CAMP-MISSING'), null);
});
