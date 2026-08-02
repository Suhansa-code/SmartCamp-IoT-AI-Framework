import { campDb as db } from '../../config/database.js';
import * as saamp from '../network/saamp-mqtt.js';
import * as emqx from '../network/emqx-manager.js';

function genPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export function getAllPersons({ q, person_type, sort = 'created_at', order = 'desc' } = {}) {
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('(p.full_name LIKE ? OR p.fingerprint_id LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (person_type) {
    conditions.push('p.person_type = ?');
    params.push(person_type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
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

export async function registerPerson(data) {
  const { full_name, age, gender, person_type, family_size, is_pregnant, has_chronic_illness, medical_notes } = data;

  const fpId = `FP_${Date.now()}`;
  const familyUnitId = `FAM_${Date.now()}`;

  const result = db.prepare(`
    INSERT INTO persons (fingerprint_id, full_name, age, gender, person_type, family_unit_id, family_size,
      is_pregnant, has_chronic_illness, medical_notes, pre_registered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(fpId, full_name, parseInt(age), gender || 'M', person_type || 'refugee', familyUnitId,
    parseInt(family_size) || 1, is_pregnant || 0, has_chronic_illness || 0, medical_notes || '');

  const personId = result.lastInsertRowid;

  db.prepare('INSERT INTO camp_checkins (person_id, camp_day, is_new_arrival) VALUES (?, 1, 1)').run(personId);

  const barcode = `WB${String(personId).padStart(6, '0')}`;
  db.prepare('INSERT INTO wristbands (person_id, barcode) VALUES (?, ?)').run(personId, barcode);

  const clientId = `sc-person-${personId}`;
  const password = genPassword();
  await emqx.createMqttUser(clientId, password);
  db.prepare('UPDATE persons SET mqtt_client_id = ?, mqtt_password = ? WHERE id = ?').run(clientId, password, personId);

  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);

  const mqttResult = await saamp.publishAsClient(
    'smartcamp/registration/new',
    { event: 'new_registration', person, wristband_barcode: barcode, timestamp: new Date().toISOString() },
    clientId, password, 'fingerprint_scanner', 'new_registration'
  );

  return { person, wristband_barcode: barcode, mqtt: mqttResult };
}
