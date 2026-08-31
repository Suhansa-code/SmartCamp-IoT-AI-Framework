import { campDb as db } from '../../config/database.js';
import { audit } from './resources.js';
import { getDailyLeft } from './rations.js';
import QRCode from 'qrcode';
import { enqueueSync } from '../sync/sync-notify.js';

const VALID_STATUSES = ['AVAILABLE', 'ASSIGNED', 'LOST', 'DAMAGED', 'INACTIVE'];
const INACTIVE_STATUSES = ['LOST', 'DAMAGED', 'INACTIVE'];

export function getWristbandInfo(barcode) {
  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ? AND is_active = 1').get(barcode);
  if (!wristband) throw Object.assign(new Error('Wristband not found'), { status: 404 });

  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(wristband.person_id);
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });

  const distributions = db.prepare(
    "SELECT resource_type FROM distributions WHERE wristband_barcode = ? AND DATE(distributed_at) = DATE('now')"
  ).all(barcode);

  const givenSet = new Set(distributions.map(d => d.resource_type));

  const todayDistributions = {
    breakfast: givenSet.has('breakfast'),
    lunch: givenSet.has('lunch'),
    dinner: givenSet.has('dinner'),
    water: givenSet.has('water'),
  };

  // Get total water issued today
  const waterRow = db.prepare(
    "SELECT SUM(quantity) as total FROM distributions WHERE wristband_barcode = ? AND resource_type = 'water' AND DATE(distributed_at) = DATE('now')"
  ).get(barcode);
  const waterIssued = waterRow?.total || 0;

  return {
    person,
    wristband_barcode: barcode,
    today_distributions: todayDistributions,
    water_issued: waterIssued,
    water_max: 6,
    daily: getDailyLeft(person, todayDistributions),
  };
}

export function getDistributionHistory(barcode, { days } = {}) {
  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ?').get(barcode);
  if (!wristband) throw Object.assign(new Error('Wristband not found'), { status: 404 });

  let whereClause = 'wristband_barcode = ?';
  const params = [barcode];

  if (days) {
    whereClause += " AND distributed_at >= DATE('now', ? || ' days')";
    params.push(`-${parseInt(days)}`);
  }

  const rows = db.prepare(`
    SELECT id, resource_type, quantity, distributed_at
    FROM distributions
    WHERE ${whereClause}
    ORDER BY distributed_at DESC
  `).all(...params);

  return { barcode, distributions: rows, total: rows.length };
}

/* ═══════════════════════════════════════════════════════════════════
 *  QR-WRISTBAND MANAGEMENT — list, search, status, assignment, reuse
 * ═══════════════════════════════════════════════════════════════════ */

/* ── Inventory statistics ──────────────────────────────────────
 *  Total Printed = Available + Assigned + Lost/Disabled
 *  Remaining Stock = still-usable unassigned (Available)
 */
export function getWristbandStats() {
  const rows = db.prepare('SELECT status, COUNT(*) AS c FROM wristbands GROUP BY status').all();
  const byStatus = {};
  for (const r of rows) byStatus[r.status] = r.c;

  const total = rows.reduce((sum, r) => sum + r.c, 0);
  const available = byStatus.AVAILABLE || 0;
  const assigned = byStatus.ASSIGNED || 0;
  const lost = byStatus.LOST || 0;
  const damaged = byStatus.DAMAGED || 0;
  const inactive = byStatus.INACTIVE || 0;
  const unavailable = lost + damaged + inactive;

  return {
    total,
    available,
    assigned,
    lost,
    damaged,
    inactive,
    unavailable,
    remaining: available,
    assignment_percentage: total ? Math.round((assigned / total) * 1000) / 10 : 0,
  };
}

/* ── Batch generation ──────────────────────────────────────────
 *  Pre-print wristbands in bulk. Codes are sequential (e.g. WB-000001)
 *  and unique; the QR payload is always the opaque wristband identifier,
 *  never personal information.
 */
export function createWristbandsBatch({ count = 10, prefix = 'WB-' } = {}) {
  const n = Math.max(1, Math.min(parseInt(count) || 1, 500));
  const pad = 6;

  const existing = db.prepare('SELECT barcode FROM wristbands WHERE barcode LIKE ?').all(`${prefix}%`);
  let maxSeq = 0;
  for (const r of existing) {
    const m = /-(\d+)$/.exec(r.barcode) || /(\d+)$/.exec(r.barcode);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }

  const run = db.transaction(() => {
    const created = [];
    let seq = maxSeq;
    let attempts = 0;
    while (created.length < n && attempts < n * 3) {
      seq += 1;
      attempts += 1;
      const barcode = `${prefix}${String(seq).padStart(pad, '0')}`;
      const qr = `CAMP-${barcode}`;
      if (db.prepare('SELECT id FROM wristbands WHERE barcode = ? OR qr_identifier = ?').get(barcode, qr)) continue;
      db.prepare("INSERT INTO wristbands (barcode, qr_identifier, status, issued_at, updated_at) VALUES (?, ?, 'AVAILABLE', datetime('now'), datetime('now'))")
        .run(barcode, qr);
      created.push({ barcode, qr_identifier: qr, status: 'AVAILABLE' });
    }
    return created;
  });

  const created = run();
  return {
    created,
    count: created.length,
    total: db.prepare('SELECT COUNT(*) AS c FROM wristbands').get().c,
  };
}

/* ── Printable QR sheet ────────────────────────────────────────
 *  Self-contained HTML page: one QR card per wristband, laid out in a
 *  grid for printing. No server assets required.
 */
export async function generateWristbandQRSheet({ status, limit = 200 } = {}) {
  const list = listWristbands({ status });
  const rows = list.wristbands.slice(0, Math.max(1, parseInt(limit) || 200));

  const cards = [];
  for (const wb of rows) {
    const payload = wb.qr_identifier || wb.wristband_id || `CAMP-${wb.wristband_id}`;
    const dataUrl = await QRCode.toDataURL(String(payload), { width: 180, margin: 1 });
    cards.push(`
      <div class="card">
        <img src="${dataUrl}" width="150" height="150" alt="QR" />
        <div class="wid">${wb.wristband_id}</div>
        <div class="qid">${payload}</div>
      </div>`);
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>SmartCamp — Wristband QR Print Sheet</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, Menlo, Consolas, monospace; margin: 0; padding: 16px; background: #fff; color: #111; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
  .card { border: 1px solid #e2e2e0; border-radius: 10px; padding: 10px; text-align: center; page-break-inside: avoid; }
  .card img { display: block; margin: 0 auto; }
  .wid { font-size: 13px; font-weight: 700; margin-top: 6px; letter-spacing: 0.04em; }
  .qid { font-size: 10px; color: #888; margin-top: 2px; word-break: break-all; }
  @media print { .grid { grid-template-columns: repeat(4, 1fr); } body { padding: 8mm; } }
</style>
</head>
<body>
  <h1>SmartCamp — Wristband QR Print Sheet</h1>
  <div class="meta">${rows.length} wristbands${status ? ` · status ${String(status).toUpperCase()}` : ''}</div>
  <div class="grid">${cards.join('')}</div>
</body>
</html>`;
}

function getWristbandRow(idOrRef) {
  const id = Number(idOrRef);
  const wristband = Number.isInteger(id) && id > 0
    ? db.prepare('SELECT * FROM wristbands WHERE id = ?').get(id)
    : db.prepare('SELECT * FROM wristbands WHERE barcode = ? OR qr_identifier = ?').get(idOrRef, idOrRef);
  if (!wristband) throw Object.assign(new Error('Wristband not found'), { status: 404 });
  return wristband;
}

export function listWristbands({ q, status, assigned } = {}) {
  const conditions = [];
  const params = [];
  if (q) {
    conditions.push('(w.barcode LIKE ? OR w.qr_identifier LIKE ? OR p.full_name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) { conditions.push('w.status = ?'); params.push(String(status).toUpperCase()); }
  if (assigned === 'true' || assigned === '1') { conditions.push("w.status = 'ASSIGNED'"); }
  if (assigned === 'false' || assigned === '0') { conditions.push("w.status = 'AVAILABLE'"); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT w.id, w.barcode AS wristband_id, w.qr_identifier, w.status, w.issued_at,
           w.assigned_at, w.updated_at, w.is_active,
           p.id AS person_id, p.full_name AS assigned_person
    FROM wristbands w
    LEFT JOIN wristband_assignments a ON a.wristband_id = w.id AND a.unassigned_at IS NULL
    LEFT JOIN persons p ON p.id = COALESCE(a.person_id, w.person_id)
    ${where}
    ORDER BY w.barcode
  `).all(...params);

  return { wristbands: rows, total: rows.length };
}

export function getWristbandById(id) {
  const wristband = getWristbandRow(id);
  const assignment = db.prepare(`
    SELECT a.person_id, p.full_name, a.assigned_at
    FROM wristband_assignments a LEFT JOIN persons p ON p.id = a.person_id
    WHERE a.wristband_id = ? AND a.unassigned_at IS NULL
    ORDER BY a.id DESC LIMIT 1
  `).get(wristband.id);

  const assignments = db.prepare(`
    SELECT a.id, a.person_id, p.full_name, a.assigned_at, a.unassigned_at
    FROM wristband_assignments a LEFT JOIN persons p ON p.id = a.person_id
    WHERE a.wristband_id = ?
    ORDER BY a.assigned_at DESC
  `).all(wristband.id);

  return {
    ...wristband,
    wristband_id: wristband.barcode,
    assigned_person_id: assignment?.person_id ?? wristband.person_id ?? null,
    assigned_person_name: assignment?.full_name ?? null,
    assigned_at: assignment?.assigned_at ?? wristband.assigned_at ?? null,
    assignment_history: assignments,
  };
}

export function createWristband({ wristband_id, qr_identifier, status } = {}) {
  const barcode = wristband_id || `WB-${Math.floor(Math.random() * 9000 + 1000)}`;
  const qr = qr_identifier || (barcode.startsWith('CAMP-') ? barcode : `CAMP-${barcode}`);

  if (db.prepare('SELECT id FROM wristbands WHERE barcode = ? OR qr_identifier = ?').get(barcode, qr)) {
    throw Object.assign(new Error('A wristband with this identifier already exists.'), { status: 409 });
  }

  const result = db.prepare(`
    INSERT INTO wristbands (barcode, qr_identifier, status, issued_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `).run(barcode, qr, VALID_STATUSES.includes(status) ? status : 'AVAILABLE');

  audit({ actor: null, action: 'wristband_create', wristband_id: result.lastInsertRowid, details: `${barcode}` });
  enqueueSync('wristbands', result.lastInsertRowid);
  return getWristbandById(result.lastInsertRowid);
}

export function updateWristbandStatus(id, status, { actor } = {}) {
  const wristband = getWristbandRow(id);
  if (!VALID_STATUSES.includes(status)) {
    throw Object.assign(new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`), { status: 400 });
  }

  if (status === 'AVAILABLE') {
    closeOpenAssignment(wristband.id, actor);
  }

  db.prepare("UPDATE wristbands SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, wristband.id);
  audit({ actor, action: 'wristband_status', wristband_id: wristband.id, details: `${wristband.barcode} → ${status}` });
  return getWristbandById(wristband.id);
}

export function markWristbandLost(id, { actor } = {}) {
  return updateWristbandStatus(id, 'LOST', { actor });
}

export function markWristbandDamaged(id, { actor } = {}) {
  return updateWristbandStatus(id, 'DAMAGED', { actor });
}

function closeOpenAssignment(wristbandId, actor) {
  const open = db.prepare('SELECT id, person_id FROM wristband_assignments WHERE wristband_id = ? AND unassigned_at IS NULL').get(wristbandId);
  if (open) {
    db.prepare("UPDATE wristband_assignments SET unassigned_at = datetime('now') WHERE id = ?").run(open.id);
    audit({
      actor, action: 'wristband_unassign', wristband_id: wristbandId, person_id: open.person_id,
      details: `Assignment closed`,
    });
  }
}

function getAvailablePoolWristband() {
  return db.prepare("SELECT * FROM wristbands WHERE status = 'AVAILABLE' ORDER BY barcode LIMIT 1").get();
}

/**
 * Assign an AVAILABLE wristband to a person. The person's existing active
 * assignment is closed first, and the wristband's assignment history is
 * preserved (never deleted) so bands can be reused.
 */
export function assignWristband(wristbandRef, personId, { actor } = {}) {
  const wristband = getWristbandRow(wristbandRef);
  const pid = Number(personId);
  const person = db.prepare('SELECT id, full_name FROM persons WHERE id = ? AND is_active = 1').get(pid);
  if (!person) throw Object.assign(new Error('Person is inactive or does not exist.'), { status: 400 });

  if (['LOST', 'DAMAGED', 'INACTIVE'].includes(wristband.status)) {
    throw Object.assign(new Error('This wristband is inactive and cannot be assigned.'), { status: 400 });
  }

  const already = db.prepare('SELECT id FROM wristband_assignments WHERE wristband_id = ? AND unassigned_at IS NULL').get(wristband.id);
  if (already) {
    throw Object.assign(new Error('Wristband is already assigned.'), { status: 409 });
  }

  const assign = db.transaction(() => {
    // Release any wristband currently held by this person.
    const held = db.prepare(`
      SELECT w.id FROM wristbands w
      LEFT JOIN wristband_assignments a ON a.wristband_id = w.id AND a.unassigned_at IS NULL
      WHERE (a.person_id = ? OR w.person_id = ?) AND w.id != ?
    `).all(pid, pid, wristband.id);
    for (const w of held) closeOpenAssignment(w.id, actor);

    db.prepare('INSERT INTO wristband_assignments (wristband_id, person_id) VALUES (?, ?)').run(wristband.id, pid);
    db.prepare("UPDATE wristbands SET status = 'ASSIGNED', person_id = ?, assigned_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
      .run(pid, wristband.id);
  });
  assign();

  audit({ actor, action: 'wristband_assign', wristband_id: wristband.id, person_id: pid, details: `${wristband.barcode} → ${person.full_name}` });
  enqueueSync('wristbands', wristband.id);

  return getWristbandById(wristband.id);
}

/**
 * Check a person out of the camp: close their active assignment and free the
 * wristband for reuse. All historical records remain intact.
 */
export function unassignWristband(wristbandRef, { actor } = {}) {
  const wristband = getWristbandRow(wristbandRef);
  const open = db.prepare('SELECT id, person_id FROM wristband_assignments WHERE wristband_id = ? AND unassigned_at IS NULL').get(wristband.id);

  if (open) {
    db.prepare("UPDATE wristband_assignments SET unassigned_at = datetime('now') WHERE id = ?").run(open.id);
    audit({
      actor, action: 'wristband_unassign', wristband_id: wristband.id, person_id: open.person_id,
      details: `${wristband.barcode} → AVAILABLE`,
    });
  }

  db.prepare("UPDATE wristbands SET status = 'AVAILABLE', person_id = NULL, assigned_at = NULL, updated_at = datetime('now') WHERE id = ?")
    .run(wristband.id);

  enqueueSync('wristbands', wristband.id);

  return getWristbandById(wristband.id);
}

export function getAssignmentHistory(wristbandRef) {
  const wristband = getWristbandRow(wristbandRef);
  return getWristbandById(wristband.id).assignment_history;
}

export function getAvailableWristbands() {
  return listWristbands({ assigned: 'false' });
}

export async function generateWristbandQRCode(idOrRef, { size = 256 } = {}) {
  const wb = getWristbandRow(idOrRef);
  const payload = wb.qr_identifier || wb.barcode || `CAMP-${wb.barcode}`;
  try {
    const dataUrl = await QRCode.toDataURL(String(payload), {
      width: Number(size) || 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    return { qr_identifier: payload, data_url: dataUrl };
  } catch (err) {
    throw Object.assign(new Error('Failed to generate QR code'), { status: 500 });
  }
}

/**
 * Assign a pre-printed wristband (looked up by barcode or QR identifier) to a
 * person.  Validates that the wristband is AVAILABLE and not currently assigned
 * to another active person.
 */
export function assignWristbandByBarcode(barcode, personId, { actor } = {}) {
  if (!barcode) throw Object.assign(new Error('Wristband barcode is required.'), { status: 400 });

  const normalized = barcode.trim().toUpperCase();
  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ? OR qr_identifier = ?').get(normalized, normalized);
  if (!wristband) throw Object.assign(new Error('Wristband not recognized.'), { status: 404 });

  if (INACTIVE_STATUSES.includes(wristband.status)) {
    throw Object.assign(new Error('This wristband is inactive and cannot be assigned.'), { status: 400 });
  }

  const already = db.prepare('SELECT id FROM wristband_assignments WHERE wristband_id = ? AND unassigned_at IS NULL').get(wristband.id);
  if (already) {
    throw Object.assign(new Error('This wristband is already assigned to another person.'), { status: 409 });
  }

  return assignWristband(wristband.id, personId, { actor });
}
