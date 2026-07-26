import express from 'express';
import { campDb as db } from '../../config/database.js';
import * as saamp from '../../services/saamp-mqtt.js';
import * as emqx from '../../services/emqx-manager.js';

const router = express.Router();

function genPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

router.post('/', async (req, res) => {
  const { full_name, age, gender, person_type, family_size, is_pregnant, has_chronic_illness, medical_notes } = req.body;
  if (!full_name || !age) return res.status(400).json({ error: 'Missing required fields' });

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

  res.json({ person, wristband_barcode: barcode, mqtt: mqttResult });
});

export default router;
