import { campDb as db } from '../../config/database.js';
import { getDailyLeft } from './rations.js';

const INACTIVE_STATUSES = ['LOST', 'DAMAGED', 'INACTIVE'];

export function normalizeQr(raw) {
  return String(raw || '').trim().replace(/^([A-Za-z0-9-]+)$/, '$1');
}

/**
 * Resolve a scanned QR code along the chain:
 *   QR → wristband → current assignment → person → today's resource usage.
 * The QR payload itself is ONLY an opaque wristband identifier (e.g. CAMP-WB-0001),
 * never personal information.
 */
export function resolveQR(qrRaw) {
  const qr = normalizeQr(qrRaw);
  if (!qr) {
    throw Object.assign(new Error('QR code not recognized.'), { status: 400 });
  }

  const wristband = db.prepare('SELECT * FROM wristbands WHERE qr_identifier = ?').get(qr)
    || db.prepare('SELECT * FROM wristbands WHERE barcode = ?').get(qr);

  if (!wristband) {
    throw Object.assign(new Error('QR code not recognized.'), { status: 404 });
  }

  if (INACTIVE_STATUSES.includes(wristband.status)) {
    throw Object.assign(new Error('This wristband is inactive.'), { status: 400 });
  }

  if (wristband.status !== 'ASSIGNED' && !wristband.person_id) {
    throw Object.assign(new Error('This wristband is currently not assigned to a person.'), { status: 400 });
  }

  const person = resolveCurrentPerson(wristband);
  if (!person) {
    throw Object.assign(new Error('This wristband is currently not assigned to a person.'), { status: 400 });
  }

  const today = getTodayUsage(person.id);

  return {
    qr_identifier: qr,
    wristband: {
      id: wristband.id,
      wristband_id: wristband.barcode,
      qr_identifier: wristband.qr_identifier,
      status: wristband.status,
      assigned_at: wristband.assigned_at,
    },
    person,
    today,
    daily: getDailyLeft(person, today.meals),
  };
}

function summarizeWristband(w) {
  return {
    id: w.id,
    wristband_id: w.barcode,
    qr_identifier: w.qr_identifier || w.barcode,
    status: w.status,
    assigned_at: w.assigned_at,
  };
}

/**
 * Registration-time QR lookup. A pre-printed wristband QR may be EMPTY — not yet
 * bound to any person. Unlike resolveQR (used by the distribution scanner), this
 * reports the state so the caller can either activate the wristband by registering
 * the person, or load an existing profile:
 *   { state: 'not_found' } | { state: 'inactive', wristband } |
 *   { state: 'available', wristband } |
 *   { state: 'assigned', wristband, person, daily }
 */
export function lookupQR(qrRaw) {
  const qr = normalizeQr(qrRaw);
  if (!qr) throw Object.assign(new Error('QR code not recognized.'), { status: 400 });

  const wristband = db.prepare('SELECT * FROM wristbands WHERE qr_identifier = ?').get(qr)
    || db.prepare('SELECT * FROM wristbands WHERE barcode = ?').get(qr);

  if (!wristband) return { state: 'not_found' };

  if (INACTIVE_STATUSES.includes(wristband.status)) {
    return { state: 'inactive', wristband: summarizeWristband(wristband) };
  }

  const person = resolveCurrentPerson(wristband);
  if (!person) {
    return { state: 'available', wristband: summarizeWristband(wristband) };
  }

  const today = getTodayUsage(person.id);
  return {
    state: 'assigned',
    wristband: summarizeWristband(wristband),
    person,
    daily: getDailyLeft(person, today.meals),
  };
}

/**
 * Current assignment wins; legacy `wristbands.person_id` is the fallback so
 * pre-existing data keeps working untouched.
 */
export function resolveCurrentPerson(wristband) {
  const assignment = db.prepare(`
    SELECT a.person_id FROM wristband_assignments a
    WHERE a.wristband_id = ? AND a.unassigned_at IS NULL
    ORDER BY a.id DESC LIMIT 1
  `).get(wristband.id);

  const personId = assignment?.person_id || wristband.person_id;
  if (!personId) return null;

  return db.prepare('SELECT * FROM persons WHERE id = ? AND is_active = 1').get(personId) || null;
}

/**
 * Today's consumption for a person:
 *  - legacy meal flags (breakfast/lunch/dinner/water) for backward compat
 *  - itemised resource_usage rows grouped by meal
 */
export function getTodayUsage(personId) {
  const legacy = db.prepare(
    "SELECT resource_type FROM distributions WHERE wristband_barcode IN (SELECT barcode FROM wristbands WHERE person_id = ? OR id IN (SELECT wristband_id FROM wristband_assignments WHERE person_id = ?)) AND DATE(distributed_at) = DATE('now')"
  ).all(personId, personId).map((r) => r.resource_type);

  const usageRows = db.prepare(`
    SELECT ru.id, ru.meal, ru.quantity, ru.time, r.resource_name, r.unit, r.category
    FROM resource_usage ru
    JOIN resources r ON r.id = ru.resource_id
    WHERE ru.person_id = ? AND ru.date = date('now')
    ORDER BY ru.meal, ru.time
  `).all(personId);

  const byMeal = {};
  for (const row of usageRows) {
    const key = row.meal || 'Other';
    if (!byMeal[key]) byMeal[key] = [];
    byMeal[key].push(row);
  }

  return {
    meals: {
      breakfast: legacy.includes('breakfast'),
      lunch: legacy.includes('lunch'),
      dinner: legacy.includes('dinner'),
      water: legacy.includes('water'),
    },
    resources: usageRows,
    by_meal: byMeal,
  };
}
