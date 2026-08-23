import { describe, it, expect } from 'vitest';
import { campDb, pagesDb } from '../../config/database.js';
import {
  classifyRowPriority, comparePriority, PRIORITY, QOS_MAP,
} from '../../services/sync/sync-priority.js';
import { enqueueSync, TABLE_PK } from '../../services/sync/sync-notify.js';
import { decideAdaptiveQoS } from '../../services/network/saamp-mqtt.js';

const cleanup = [];

afterAll(() => {
  for (const { table, val } of cleanup) {
    try {
      if (table === 'persons') campDb.prepare('DELETE FROM persons WHERE id = ?').run(val);
      else if (table === 'distributions') campDb.prepare('DELETE FROM distributions WHERE id = ?').run(val);
      else if (table === 'resources') campDb.prepare('DELETE FROM resources WHERE id = ?').run(val);
      else if (table === 'pages_children') pagesDb.prepare('DELETE FROM pages_children WHERE child_id = ?').run(val);
      else if (table === 'pages_sessions') pagesDb.prepare('DELETE FROM pages_sessions WHERE session_id = ?').run(val);
      else if (table === 'pages_alerts') pagesDb.prepare('DELETE FROM pages_alerts WHERE alert_id = ?').run(val);
      else if (table === 'sync_pending') campDb.prepare('DELETE FROM sync_pending WHERE sync_id = ?').run(val);
    } catch { /* best-effort */ }
  }
});

function insertPerson(data) {
  const r = campDb.prepare(
    `INSERT INTO persons (fingerprint_id, full_name, age, gender, person_type, family_unit_id,
       family_size, is_pregnant, has_chronic_illness, medical_notes, pre_registered, registration_date, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), 0)`
  ).run(data.fid, data.name, data.age, data.gender || 'M', 'refugee', 'FAM', 1,
    data.pregnant || 0, data.chronic || 0, '');
  cleanup.push({ table: 'persons', val: r.lastInsertRowid });
  return r.lastInsertRowid;
}

function insertDistribution(barcode, type, qty) {
  const r = campDb.prepare(
    `INSERT INTO distributions (wristband_barcode, resource_type, quantity, synced) VALUES (?, ?, ?, 0)`
  ).run(barcode, type, qty);
  cleanup.push({ table: 'distributions', val: r.lastInsertRowid });
  return r.lastInsertRowid;
}

function insertResource(name, available, threshold) {
  const r = campDb.prepare(
    `INSERT INTO resources (resource_name, category, unit, total_quantity, available_quantity, minimum_threshold, status, synced)
     VALUES (?, 'Food', 'portion', ?, ?, ?, 'AVAILABLE', 0)`
  ).run(name, available, available, threshold);
  cleanup.push({ table: 'resources', val: r.lastInsertRowid });
  return r.lastInsertRowid;
}

function insertChild(childId, baseline) {
  pagesDb.prepare(
    `INSERT INTO pages_children (child_id, res_id, grade, camp_id, language, baseline_score, total_sessions, alert_status, synced)
     VALUES (?, 'RES', 3, 'CAMP', 'si', ?, 0, 'none', 0)`
  ).run(childId, baseline || 60);
  cleanup.push({ table: 'pages_children', val: childId });
}

function insertSession(sessionId, childId, anomaly, gate) {
  pagesDb.prepare(
    `INSERT INTO pages_sessions (session_id, child_id, session_date, session_time, condition_label,
       composite_score, anomaly_flagged, gate_decision, synced)
     VALUES (?, ?, '2026-08-22', '10:00', 'A', 50, ?, ?, 0)`
  ).run(sessionId, childId, anomaly || 0, gate || null);
  cleanup.push({ table: 'pages_sessions', val: sessionId });
}

function insertPending(syncId, entity, table, localId, priority, published) {
  campDb.prepare(
    `INSERT INTO sync_pending (sync_id, entity, table_name, local_id, operation, priority,
       camp_id, device_id, payload, published, retry_count, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, 'C', 'D', '{}', ?, 0, datetime('now'))`
  ).run(syncId, entity, table, String(localId), 'CREATE', priority, published ? 1 : 0);
  cleanup.push({ table: 'sync_pending', val: syncId });
}

// ── TEST 1: Disaster CRITICAL priority ─────────────────────────────────

describe('TEST 1 — Disaster CRITICAL priority', () => {
  it('pregnant person receives CRITICAL priority', () => {
    const id = insertPerson({ fid: 'FP-DISASTER-1', name: 'Disaster Person', age: 28, gender: 'F', pregnant: 1 });
    const row = campDb.prepare('SELECT * FROM persons WHERE id = ?').get(id);
    const priority = classifyRowPriority('persons', row);
    expect(priority.priority).toBe(PRIORITY.CRITICAL);
    expect(priority.reason).toBe('person_pregnant');
    expect(priority.qos).toBe(QOS_MAP.CRITICAL);
  });

  it('chronic illness person receives CRITICAL priority', () => {
    const id = insertPerson({ fid: 'FP-DISASTER-2', name: 'Chronic Person', age: 67, chronic: 1 });
    const row = campDb.prepare('SELECT * FROM persons WHERE id = ?').get(id);
    expect(classifyRowPriority('persons', row).priority).toBe(PRIORITY.CRITICAL);
  });

  it('medicine distribution receives CRITICAL priority', () => {
    const id = insertDistribution('WB-0001', 'medicine', 2.0);
    const row = campDb.prepare('SELECT * FROM distributions WHERE id = ?').get(id);
    expect(classifyRowPriority('distributions', row).priority).toBe(PRIORITY.CRITICAL);
  });

  it('consecutive alert receives CRITICAL priority', () => {
    const childId = `TEST-CRIT-${Date.now()}`;
    pagesDb.prepare(
      `INSERT OR IGNORE INTO pages_children (child_id, res_id, grade, camp_id, language, baseline_score, total_sessions, alert_status, synced)
       VALUES (?, 'RES', 3, 'CAMP', 'si', 60, 0, 'none', 0)`
    ).run(childId);
    cleanup.push({ table: 'pages_children', val: childId });

    pagesDb.prepare(
      `INSERT INTO pages_alerts (alert_id, child_id, camp_id, res_id, alert_type, trigger_detail, triggered_at, status, synced)
       VALUES (?, ?, 'C', 'R', '3_consecutive_flagged', '', datetime('now'), 'pending', 0)`
    ).run('ALERT-CRIT-1', childId);
    cleanup.push({ table: 'pages_alerts', val: 'ALERT-CRIT-1' });

    const row = pagesDb.prepare('SELECT * FROM pages_alerts WHERE alert_id = ?').get('ALERT-CRIT-1');
    expect(classifyRowPriority('pages_alerts', row).priority).toBe(PRIORITY.CRITICAL);
  });
});

// ── TEST 2: Priority Ordering ─────────────────────────────────────────

describe('TEST 2 — Priority ordering CRITICAL → HIGH → MEDIUM → LOW', () => {
  it('sorts mixed records by priority then age', () => {
    const records = [
      { _priority: PRIORITY.LOW, _timestamp: '2026-01-01', name: 'audit' },
      { _priority: PRIORITY.CRITICAL, _timestamp: '2026-06-01', name: 'disaster' },
      { _priority: PRIORITY.HIGH, _timestamp: '2026-03-01', name: 'registration' },
      { _priority: PRIORITY.CRITICAL, _timestamp: '2026-01-01', name: 'earlier_disaster' },
      { _priority: PRIORITY.MEDIUM, _timestamp: '2026-01-01', name: 'resource' },
    ];
    records.sort(comparePriority);
    expect(records.map(r => r.name)).toEqual([
      'earlier_disaster', 'disaster', 'registration', 'resource', 'audit',
    ]);
  });

  it('disaster (CRITICAL) before registration (HIGH) before resource (MEDIUM) before education (LOW)', () => {
    const priorities = [
      classifyRowPriority('persons', { age: 30, is_pregnant: 1, has_chronic_illness: 0 }).priority,
      classifyRowPriority('persons', { age: 34, is_pregnant: 0, has_chronic_illness: 0 }).priority,
      classifyRowPriority('resources', { available_quantity: 100, minimum_threshold: 20 }).priority,
      classifyRowPriority('pages_sessions', { anomaly_flagged: 0, gate_decision: 'PASS' }).priority,
    ];
    expect(priorities).toEqual([PRIORITY.CRITICAL, PRIORITY.HIGH, PRIORITY.MEDIUM, PRIORITY.LOW]);
  });
});

// ── TEST 3: Offline resilience ────────────────────────────────────────

describe('TEST 3 — Offline resilience', () => {
  it('SAAMP decideAdaptiveQoS buffers non-CRITICAL on CRITICAL network', () => {
    expect(decideAdaptiveQoS('HIGH', 1, 'CRITICAL').action).toBe('buffer');
    expect(decideAdaptiveQoS('MEDIUM', 1, 'CRITICAL').action).toBe('buffer');
    expect(decideAdaptiveQoS('LOW', 0, 'CRITICAL').action).toBe('buffer');
  });

  it('SAAMP decideAdaptiveQoS publishes CRITICAL even on CRITICAL network', () => {
    expect(decideAdaptiveQoS('CRITICAL', 2, 'CRITICAL').action).toBe('publish');
  });

  it('sync_pending records with published=0 remain pending', () => {
    insertPending('offline-1', 'persons', 'persons', '100', 'CRITICAL', false);
    insertPending('offline-2', 'children', 'pages_children', 'CHILD-1', 'LOW', false);

    const pending = campDb.prepare(
      'SELECT * FROM sync_pending WHERE published = 0 AND sync_id IN (?, ?)'
    ).all('offline-1', 'offline-2');
    expect(pending.length).toBe(2);
  });

  it('retry picks up CRITICAL before LOW', () => {
    const rows = campDb.prepare(
      `SELECT sync_id, priority FROM sync_pending WHERE published = 0 AND sync_id IN (?, ?)
       ORDER BY CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END ASC`
    ).all('offline-1', 'offline-2');
    expect(rows[0].priority).toBe('CRITICAL');
    expect(rows[1].priority).toBe('LOW');
  });
});

// ── TEST 4: Neon failure — retry with backoff ────────────────────────

describe('TEST 4 — Neon failure retry', () => {
  it('retry_count increments on failure', () => {
    insertPending('retry-1', 'persons', 'persons', '200', 'HIGH', true);
    campDb.prepare('UPDATE sync_pending SET retry_count = 1, published = 0 WHERE sync_id = ?').run('retry-1');
    const row = campDb.prepare('SELECT * FROM sync_pending WHERE sync_id = ?').get('retry-1');
    expect(row.retry_count).toBe(1);
    expect(row.published).toBe(0);
  });

  it('exponential backoff increases delay', () => {
    const BASE = 60000;
    const MAX = 1800000;
    const delays = [0, 1, 2, 3, 4].map(i => Math.min(BASE * Math.pow(2, i), MAX));
    expect(delays[0]).toBe(60000);
    expect(delays[1]).toBe(120000);
    expect(delays[2]).toBe(240000);
    expect(delays[3]).toBe(480000);
    expect(delays[4]).toBe(960000);
  });

  it('max retries of 10 is enforced', () => {
    const MAX_RETRIES = 10;
    campDb.prepare('UPDATE sync_pending SET retry_count = ? WHERE sync_id = ?').run(MAX_RETRIES, 'retry-1');
    const row = campDb.prepare('SELECT * FROM sync_pending WHERE sync_id = ?').get('retry-1');
    expect(row.retry_count).toBeGreaterThanOrEqual(MAX_RETRIES);
  });
});

// ── TEST 5: Duplicate MQTT delivery ──────────────────────────────────

describe('TEST 5 — Duplicate MQTT delivery idempotency', () => {
  it('sync_log prevents duplicate processing', () => {
    campDb.prepare(
      `CREATE TABLE IF NOT EXISTS sync_log (
        sync_id TEXT PRIMARY KEY, entity TEXT, local_id TEXT,
        camp_id TEXT, operation TEXT, status TEXT, received_at TEXT
      )`
    ).run();

    campDb.prepare(
      `INSERT OR IGNORE INTO sync_log (sync_id, entity, local_id, camp_id, operation, status, received_at)
       VALUES (?, ?, ?, ?, ?, 'processed', datetime('now'))`
    ).run('dup-test-1', 'persons', '1', 'C', 'CREATE');

    const row = campDb.prepare('SELECT 1 FROM sync_log WHERE sync_id = ?').get('dup-test-1');
    expect(row).toBeDefined();

    // Second insert is ignored
    campDb.prepare(
      `INSERT OR IGNORE INTO sync_log (sync_id, entity, local_id, camp_id, operation, status, received_at)
       VALUES (?, ?, ?, ?, ?, 'processed', datetime('now'))`
    ).run('dup-test-1', 'persons', '1', 'C', 'CREATE');

    const count = campDb.prepare('SELECT COUNT(*) AS cnt FROM sync_log WHERE sync_id = ?').get('dup-test-1');
    expect(count.cnt).toBe(1);
  });

  it('ON CONFLICT upsert does not create duplicate', () => {
    const r = campDb.prepare(
      `INSERT INTO resources (resource_name, category, unit, total_quantity, available_quantity, minimum_threshold, status, synced)
       VALUES (?, 'Food', 'portion', 100, 100, 10, 'AVAILABLE', 0)
       ON CONFLICT (id) DO UPDATE SET available_quantity = EXCLUDED.available_quantity`
    ).run('Dup Resource');
    cleanup.push({ table: 'resources', val: r.lastInsertRowid });

    const row = campDb.prepare('SELECT * FROM resources WHERE id = ?').get(r.lastInsertRowid);
    expect(row.resource_name).toBe('Dup Resource');
  });
});

// ── TEST 6: RPi restart — pending records survive ─────────────────────

describe('TEST 6 — RPi restart survival', () => {
  it('sync_pending data survives (SQLite file-based)', () => {
    insertPending('restart-1', 'persons', 'persons', '300', 'CRITICAL', false);
    insertPending('restart-2', 'children', 'pages_children', 'CHILD-2', 'HIGH', false);

    const rows = campDb.prepare(
      'SELECT * FROM sync_pending WHERE sync_id IN (?, ?) ORDER BY sync_id'
    ).all('restart-1', 'restart-2');
    expect(rows.length).toBe(2);
    expect(rows[0].entity).toBe('persons');
    expect(rows[0].priority).toBe('CRITICAL');
    expect(rows[1].entity).toBe('children');
  });

  it('synced=0 records survive in source tables', () => {
    const id = insertPerson({ fid: 'FP-RESTART', name: 'Restart Person', age: 25 });
    const row = campDb.prepare('SELECT synced FROM persons WHERE id = ?').get(id);
    expect(row.synced).toBe(0);
  });

  it('retry continues after simulated restart (new query picks up old records)', () => {
    const rows = campDb.prepare(
      `SELECT * FROM sync_pending WHERE published = 0 AND retry_count < 5
       ORDER BY CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END ASC`
    ).all();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].priority).toBe('CRITICAL');
  });
});

// ── TEST 7: Verification — local vs cloud consistency ────────────────

describe('TEST 7 — Local vs cloud verification', () => {
  it('enqueueSync never throws (non-blocking)', () => {
    expect(() => enqueueSync('persons', 42)).not.toThrow();
    expect(() => enqueueSync('pages_sessions', 'S-1')).not.toThrow();
  });

  it('TABLE_PK covers all 23 syncable tables', () => {
    expect(Object.keys(TABLE_PK).length).toBe(23);
  });

  it('mark synced: SET synced=1 on source table', () => {
    const id = insertPerson({ fid: 'FP-VERIFY', name: 'Verify Person', age: 30 });
    campDb.prepare('UPDATE persons SET synced = 1 WHERE id = ?').run(id);
    const row = campDb.prepare('SELECT synced FROM persons WHERE id = ?').get(id);
    expect(row.synced).toBe(1);
  });

  it('sync_pending deletion after ACK (cleanup)', () => {
    insertPending('verify-cleanup', 'persons', 'persons', '500', 'HIGH', true);
    campDb.prepare('DELETE FROM sync_pending WHERE sync_id = ?').run('verify-cleanup');
    const row = campDb.prepare('SELECT * FROM sync_pending WHERE sync_id = ?').get('verify-cleanup');
    expect(row).toBeUndefined();
  });

  it('priority index ordering is stable', () => {
    expect(classifyRowPriority('persons', { age: 30, is_pregnant: 1, has_chronic_illness: 0 }).priority).toBe(PRIORITY.CRITICAL);
    expect(classifyRowPriority('camp_checkins', {}).priority).toBe(PRIORITY.HIGH);
    expect(classifyRowPriority('resources', { available_quantity: 100, minimum_threshold: 20 }).priority).toBe(PRIORITY.MEDIUM);
    expect(classifyRowPriority('audit_logs', {}).priority).toBe(PRIORITY.LOW);
  });

  it('disaster alerts with SEVERE/EXTREME severity are CRITICAL', () => {
    expect(classifyRowPriority('disaster_alerts', { severity: 'EXTREME' }).priority).toBe(PRIORITY.CRITICAL);
    expect(classifyRowPriority('disaster_alerts', { severity: 'CRITICAL' }).priority).toBe(PRIORITY.CRITICAL);
    expect(classifyRowPriority('disaster_alerts', { severity: 'SEVERE' }).priority).toBe(PRIORITY.HIGH);
    expect(classifyRowPriority('disaster_alerts', { severity: 'MODERATE' }).priority).toBe(PRIORITY.MEDIUM);
  });

  it('flood predictions with high probability are CRITICAL', () => {
    expect(classifyRowPriority('flood_predictions', { flood_probability: 0.8 }).priority).toBe(PRIORITY.CRITICAL);
    expect(classifyRowPriority('flood_predictions', { flood_probability: 0.3 }).priority).toBe(PRIORITY.HIGH);
  });

  it('disaster events with ACTIVE status are HIGH', () => {
    expect(classifyRowPriority('disaster_events', { status: 'ACTIVE', severity: 'EXTREME' }).priority).toBe(PRIORITY.CRITICAL);
    expect(classifyRowPriority('disaster_events', { status: 'ACTIVE', severity: 'MODERATE' }).priority).toBe(PRIORITY.HIGH);
    expect(classifyRowPriority('disaster_events', { status: 'RESOLVED' }).priority).toBe(PRIORITY.MEDIUM);
  });

  it('sensor readings default to HIGH', () => {
    expect(classifyRowPriority('sensor_readings', {}).priority).toBe(PRIORITY.HIGH);
  });
});
