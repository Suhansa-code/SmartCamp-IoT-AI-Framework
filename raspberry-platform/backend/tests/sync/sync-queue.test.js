import { describe, it, expect, afterAll } from 'vitest';
import { campDb, pagesDb } from '../../config/database.js';
import { classifyRowPriority, PRIORITY } from '../../services/sync/sync-priority.js';

const cleanup = [];

afterAll(() => {
  for (const { table, key, val } of cleanup) {
    try {
      if (table === 'persons') campDb.prepare('DELETE FROM persons WHERE id = ?').run(val);
      else if (table === 'distributions') campDb.prepare('DELETE FROM distributions WHERE id = ?').run(val);
      else if (table === 'pages_children') pagesDb.prepare('DELETE FROM pages_children WHERE child_id = ?').run(val);
      else if (table === 'pages_sessions') pagesDb.prepare('DELETE FROM pages_sessions WHERE session_id = ?').run(val);
      else if (table === 'pages_alerts') pagesDb.prepare('DELETE FROM pages_alerts WHERE alert_id = ?').run(val);
      else if (table === 'sync_pending') campDb.prepare('DELETE FROM sync_pending WHERE sync_id = ?').run(val);
    } catch { /* best-effort */ }
  }
});

function makePerson(data) {
  const r = campDb.prepare(
    `INSERT INTO persons (fingerprint_id, full_name, age, gender, person_type, family_unit_id,
       family_size, is_pregnant, has_chronic_illness, medical_notes, pre_registered, registration_date, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), 0)`
  ).run(data.fid, data.name, data.age, data.gender || 'M', 'refugee', 'FAM-T', 1,
    data.pregnant || 0, data.chronic || 0, '');
  cleanup.push({ table: 'persons', key: 'id', val: r.lastInsertRowid });
  return r.lastInsertRowid;
}

describe('sync-queue — pending record discovery', () => {
  it('new records have synced=0', () => {
    const id = makePerson({ fid: 'FP-T001', name: 'A', age: 30 });
    const row = campDb.prepare('SELECT synced FROM persons WHERE id = ?').get(id);
    expect(row.synced).toBe(0);
  });

  it('priority: pregnant person is CRITICAL', () => {
    const id = makePerson({ fid: 'FP-T002', name: 'B', age: 28, gender: 'F', pregnant: 1 });
    const row = campDb.prepare('SELECT * FROM persons WHERE id = ?').get(id);
    expect(classifyRowPriority('persons', row).priority).toBe(PRIORITY.CRITICAL);
  });

  it('priority: medicine distribution is CRITICAL', () => {
    const r = campDb.prepare(
      `INSERT INTO distributions (wristband_barcode, resource_type, quantity, synced) VALUES (?, ?, ?, 0)`
    ).run('WB-0001', 'medicine', 1.0);
    cleanup.push({ table: 'distributions', key: 'id', val: r.lastInsertRowid });
    const row = campDb.prepare('SELECT * FROM distributions WHERE id = ?').get(r.lastInsertRowid);
    expect(classifyRowPriority('distributions', row).priority).toBe(PRIORITY.CRITICAL);
  });

  it('synced=1 records are excluded from pending', () => {
    const id = makePerson({ fid: 'FP-T003', name: 'C', age: 40 });
    campDb.prepare('UPDATE persons SET synced = 1 WHERE id = ?').run(id);
    const rows = campDb.prepare('SELECT * FROM persons WHERE synced = 0 AND id = ?').all(id);
    expect(rows.length).toBe(0);
  });

  it('sync_pending table exists with correct schema', () => {
    const cols = campDb.prepare('PRAGMA table_info(sync_pending)').all().map(c => c.name);
    expect(cols).toContain('sync_id');
    expect(cols).toContain('entity');
    expect(cols).toContain('priority');
    expect(cols).toContain('published');
    expect(cols).toContain('retry_count');
  });

  it('sync_pending records persist across queries (restart-safe)', () => {
    campDb.prepare(
      `INSERT INTO sync_pending (sync_id, entity, table_name, local_id, operation, priority,
         camp_id, device_id, payload, published, retry_count, next_retry_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`
    ).run('restart-test-1', 'persons', 'persons', '999', 'CREATE', 'HIGH', 'CAMP', 'DEV', '{}');
    cleanup.push({ table: 'sync_pending', key: 'sync_id', val: 'restart-test-1' });

    const row = campDb.prepare('SELECT * FROM sync_pending WHERE sync_id = ?').get('restart-test-1');
    expect(row).toBeDefined();
    expect(row.entity).toBe('persons');
    expect(row.published).toBe(0);
  });

  it('priority ordering: CRITICAL before HIGH before MEDIUM before LOW', () => {
    const now = new Date().toISOString();
    const ids = ['po-1', 'po-2', 'po-3', 'po-4'];
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    for (let i = 0; i < 4; i++) {
      campDb.prepare(
        `INSERT INTO sync_pending (sync_id, entity, table_name, local_id, operation, priority,
           camp_id, device_id, payload, published, retry_count, next_retry_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
      ).run(ids[i], 'persons', 'persons', String(i), 'CREATE', priorities[i], 'C', 'D', '{}', now);
      cleanup.push({ table: 'sync_pending', key: 'sync_id', val: ids[i] });
    }

    const rows = campDb.prepare(
      `SELECT sync_id, priority FROM sync_pending WHERE sync_id IN (?, ?, ?, ?)
       ORDER BY CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END ASC`
    ).all(...ids);
    expect(rows.map(r => r.priority)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
  });
});
