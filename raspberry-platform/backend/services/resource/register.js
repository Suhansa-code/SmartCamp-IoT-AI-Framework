import { campDb as db, pagesDb } from '../../config/database.js';
import C from '../../config/constants.js';
import * as saamp from '../network/saamp-mqtt.js';
import * as emqx from '../network/emqx-manager.js';
import { genPassword, genId } from '../../utils/crypto.js';
import { generateWristbandQRCode } from './wristband.js';
import { audit } from './resources.js';
import { nextChildId, nowISO } from '../../utils/helpers.js';
import { enqueueSync, enqueueSyncBatch } from '../sync/sync-notify.js';

const VALID_GENDERS = ['M', 'F', 'O'];
const VALID_TYPES = ['refugee', 'asylum_seeker', 'idp', 'returned_refugee', 'returned_idp', 'stateless', 'ooc'];

function validatePerson(data, { partial = false } = {}) {
  const errors = {};
  const { full_name, age, gender, person_type, family_size } = data;

  if (!partial || full_name !== undefined) {
    if (!full_name || !String(full_name).trim()) errors.full_name = 'Full name is required';
  }
  if (!partial || age !== undefined) {
    const a = Number(age);
    if (!age && age !== 0) errors.age = 'Age is required';
    else if (isNaN(a) || a < 0 || a > 130) errors.age = 'Age must be 0–130';
  }
  if (!partial || gender !== undefined) {
    if (gender && !VALID_GENDERS.includes(gender)) errors.gender = `Gender must be one of: ${VALID_GENDERS.join(', ')}`;
  }
  if (!partial || person_type !== undefined) {
    if (person_type && !VALID_TYPES.includes(person_type)) errors.person_type = 'Invalid person type';
  }
  if (!partial || family_size !== undefined) {
    const fs = Number(family_size);
    if (family_size !== undefined && (isNaN(fs) || fs < 1 || fs > 20)) errors.family_size = 'Family size must be 1–20';
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.fields = errors;
    throw err;
  }
}

// ── List ────────────────────────────────────────────────────
export function getAllPersons({ q, person_type, sort = 'created_at', order = 'desc' } = {}) {
  const conditions = ['p.is_active = 1'];
  const params = [];

  if (q) {
    conditions.push('(p.full_name LIKE ? OR p.fingerprint_id LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (person_type) {
    conditions.push('p.person_type = ?');
    params.push(person_type);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const allowedSorts = ['full_name', 'age', 'created_at', 'person_type'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const rows = db.prepare(`
    SELECT p.id, p.fingerprint_id, p.full_name, p.age, p.gender, p.person_type,
           p.family_unit_id, p.family_size, p.is_pregnant, p.has_chronic_illness,
           p.medical_notes, p.pre_registered, p.created_at,
           w.barcode as wristband_barcode
    FROM persons p
    LEFT JOIN wristbands w ON w.person_id = p.id AND w.is_active = 1
    ${where}
    ORDER BY p.${sortCol} ${sortOrder}
  `).all(...params);

  return { persons: rows, total: rows.length };
}

// ── Get by ID ───────────────────────────────────────────────
export function getPersonById(id) {
  const person = db.prepare(`
    SELECT p.*, w.barcode as wristband_barcode
    FROM persons p
    LEFT JOIN wristbands w ON w.person_id = p.id AND w.is_active = 1
    WHERE p.id = ? AND p.is_active = 1
  `).get(id);

  if (!person) {
    const err = new Error('Person not found');
    err.status = 404;
    throw err;
  }

  const checkinCount = db.prepare('SELECT COUNT(*) as c FROM camp_checkins WHERE person_id = ?').get(id).c;
  const lastCheckin = db.prepare('SELECT checkin_time FROM camp_checkins WHERE person_id = ? ORDER BY checkin_time DESC LIMIT 1').get(id);

  return {
    ...person,
    checkin_count: checkinCount,
    last_checkin: lastCheckin?.checkin_time || null,
  };
}

// ── Check-in History ────────────────────────────────────────
export function getCheckinsByPersonId(id) {
  const person = db.prepare('SELECT id FROM persons WHERE id = ? AND is_active = 1').get(id);
  if (!person) {
    const err = new Error('Person not found');
    err.status = 404;
    throw err;
  }

  const checkins = db.prepare(`
    SELECT c.*, w.barcode as wristband_barcode
    FROM camp_checkins c
    LEFT JOIN wristbands w ON w.person_id = c.person_id AND w.is_active = 1
    WHERE c.person_id = ?
    ORDER BY c.checkin_time DESC
  `).all(id);

  return { checkins, total: checkins.length };
}

// ── Register (transactional) ────────────────────────────────
export async function registerPerson(data) {
  const { full_name, age, gender, person_type, family_size, is_pregnant, has_chronic_illness, medical_notes, grade, school_going } = data;
  validatePerson(data);

  const existing = db.prepare(
    'SELECT id FROM persons WHERE full_name = ? AND age = ? AND gender = ? AND is_active = 1'
  ).get(String(full_name).trim(), parseInt(age), gender || 'M');
  if (existing) {
    const err = new Error('A person with the same name, age, and gender already exists');
    err.status = 409;
    err.fields = { full_name: 'Duplicate registration detected' };
    throw err;
  }

  const fpId = genId('FP');
  const familyUnitId = genId('FAM');

  // Optional: bind the new person to a physical printed QR code (wristband).
  const providedQr = data.wristband_qr ? String(data.wristband_qr).trim() : '';
  let providedWristband = null;
  if (providedQr) {
    providedWristband = db.prepare('SELECT * FROM wristbands WHERE qr_identifier = ? OR barcode = ?').get(providedQr, providedQr);
    if (!providedWristband) {
      throw Object.assign(new Error('QR code not recognized.'), { status: 404 });
    }
    if (providedWristband.status !== 'AVAILABLE') {
      throw Object.assign(new Error('This wristband is already assigned or inactive.'), { status: 409 });
    }
  }

  const insertDb = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO persons (fingerprint_id, full_name, age, gender, person_type, family_unit_id, family_size,
        is_pregnant, has_chronic_illness, medical_notes, pre_registered, registration_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(fpId, String(full_name).trim(), parseInt(age), gender || 'M', person_type || 'refugee', familyUnitId,
      parseInt(family_size) || 1, is_pregnant || 0, has_chronic_illness || 0, medical_notes || '');

    const personId = result.lastInsertRowid;
    db.prepare('INSERT INTO camp_checkins (person_id, camp_day, is_new_arrival) VALUES (?, 1, 1)').run(personId);

    let barcode;
    if (providedWristband) {
      barcode = providedWristband.barcode;
      db.prepare("UPDATE wristbands SET person_id = ?, status = 'ASSIGNED', assigned_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(personId, providedWristband.id);
      db.prepare('INSERT INTO wristband_assignments (wristband_id, person_id) VALUES (?, ?)').run(providedWristband.id, personId);
      audit({ actor: null, action: 'wristband_assign', wristband_id: providedWristband.id, person_id: personId, details: `${barcode} → ${full_name}` });
    } else {
      barcode = `WB${String(personId).padStart(6, '0')}`;
      db.prepare('INSERT INTO wristbands (person_id, barcode) VALUES (?, ?)').run(personId, barcode);
    }

    return { personId, barcode };
  });

  const { personId, barcode } = insertDb();

  enqueueSyncBatch('persons', [personId]);
  enqueueSyncBatch('camp_checkins', [personId]);
  enqueueSyncBatch('wristbands', [personId]);

  // Auto-enrol child in pages_children when age < 18
  let childId = null;
  if (parseInt(age) < 18) {
    const campId = C.CAMP_ID;
    const resId = String(personId);
    const resolvedGrade = school_going === false ? 3 : (Number(grade) || 3);

    const enrollChild = pagesDb.transaction(() => {
      const existingChild = pagesDb.prepare(
        'SELECT child_id FROM pages_children WHERE res_id = ? AND camp_id = ? LIMIT 1'
      ).get(resId, campId);

      if (existingChild) {
        return existingChild.child_id;
      }

      const newChildId = nextChildId(campId);

      pagesDb.prepare(`
        INSERT INTO pages_children (child_id, res_id, grade, camp_id, language, enrolled_at)
        VALUES (?, ?, ?, ?, 'si', ?)
      `).run(newChildId, resId, resolvedGrade, campId, nowISO());

      return newChildId;
    });

    childId = enrollChild();
    enqueueSync('pages_children', childId);
  }

  let mqttResult = null;
  try {
    const clientId = `sc-person-${personId}`;
    const password = genPassword();
    await emqx.createMqttUser(clientId, password);
    db.prepare('UPDATE persons SET mqtt_client_id = ?, mqtt_password = ? WHERE id = ?').run(clientId, password, personId);

    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    mqttResult = await saamp.publishAsClient(
      'smartcamp/registration/new',
      { event: 'new_registration', person, wristband_barcode: barcode, timestamp: new Date().toISOString() },
      clientId, password, 'fingerprint_scanner', 'new_registration'
    );
  } catch (mqttErr) {
    // MQTT failure is non-fatal — person is registered, wristband issued
    mqttResult = { error: mqttErr.message };
  }

  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
  return { person, wristband_barcode: barcode, mqtt: mqttResult, child_id: childId };
}

// ── QR Card ─────────────────────────────────────────────────
export async function getPersonQrCode(id) {
  const person = db.prepare('SELECT * FROM persons WHERE id = ? AND is_active = 1').get(id);
  if (!person) {
    const err = new Error('Person not found');
    err.status = 404;
    throw err;
  }

  const wristband = db.prepare('SELECT * FROM wristbands WHERE person_id = ? AND is_active = 1').get(id);
  if (!wristband) {
    const err = new Error('No wristband assigned');
    err.status = 404;
    throw err;
  }

  if (!wristband.qr_identifier) {
    wristband.qr_identifier = `CAMP-${wristband.barcode}`;
    db.prepare("UPDATE wristbands SET qr_identifier = ?, updated_at = datetime('now') WHERE id = ?").run(wristband.qr_identifier, wristband.id);
  }

  const { data_url } = await generateWristbandQRCode(wristband.barcode);

  return {
    person_id: person.id,
    full_name: person.full_name,
    wristband_barcode: wristband.barcode,
    qr_identifier: wristband.qr_identifier,
    data_url,
  };
}

// ── Update ──────────────────────────────────────────────────
export function updatePerson(id, data) {
  const existing = db.prepare('SELECT * FROM persons WHERE id = ? AND is_active = 1').get(id);
  if (!existing) {
    const err = new Error('Person not found');
    err.status = 404;
    throw err;
  }

  validatePerson(data, { partial: true });

  const fields = ['full_name', 'age', 'gender', 'person_type', 'family_size', 'is_pregnant', 'has_chronic_illness', 'medical_notes'];
  const updates = [];
  const params = [];

  for (const field of fields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === 'full_name') params.push(String(data[field]).trim());
      else if (field === 'age') params.push(parseInt(data[field]));
      else if (field === 'family_size') params.push(parseInt(data[field]) || 1);
      else if (field === 'is_pregnant' || field === 'has_chronic_illness') params.push(data[field] ? 1 : 0);
      else params.push(data[field]);
    }
  }

  if (updates.length === 0) {
    const err = new Error('No fields to update');
    err.status = 400;
    throw err;
  }

  params.push(id);
  db.prepare(`UPDATE persons SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  enqueueSync('persons', id);

  return getPersonById(id);
}

// ── Soft Delete ─────────────────────────────────────────────
export function deactivatePerson(id) {
  const person = db.prepare('SELECT * FROM persons WHERE id = ? AND is_active = 1').get(id);
  if (!person) {
    const err = new Error('Person not found');
    err.status = 404;
    throw err;
  }

  db.prepare('UPDATE persons SET is_active = 0 WHERE id = ?').run(id);
  db.prepare('UPDATE wristbands SET is_active = 0 WHERE person_id = ?').run(id);

  enqueueSyncBatch('persons', [id]);
  enqueueSyncBatch('wristbands', [id]);

  return { success: true, message: `Person "${person.full_name}" deactivated` };
}
