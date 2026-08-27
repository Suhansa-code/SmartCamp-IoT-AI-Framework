import { campDb as db } from '../../config/database.js';
import { redactPerson } from '../../utils/redact.js';
import * as saamp from '../network/saamp-mqtt.js';
import { enqueueSync, enqueueSyncBatch } from '../sync/sync-notify.js';

export async function checkinPerson(personId) {
  const person = db.prepare('SELECT * FROM persons WHERE id = ? AND is_active = 1').get(personId);
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });

  db.prepare('INSERT INTO camp_checkins (person_id, camp_day, is_new_arrival) VALUES (?, 1, 1)').run(personId);

  enqueueSync('camp_checkins', personId);
  enqueueSync('persons', personId);

  let wristband = db.prepare(
    'SELECT * FROM wristbands WHERE person_id = ? AND is_active = 1 ORDER BY issued_at DESC LIMIT 1'
  ).get(personId);

  if (!wristband) {
    const barcode = `WB${String(personId).padStart(6, '0')}`;
    db.prepare('INSERT INTO wristbands (person_id, barcode) VALUES (?, ?)').run(personId, barcode);
    wristband = { barcode };
  }


  const mqttResult = await saamp.publish(
    'smartcamp/registration/checkin',
    {
      event: 'checkin',
      person: redactPerson(person),
      wristband_barcode: wristband.barcode,
      timestamp: new Date().toISOString(),
    },
    'fingerprint_scanner', 'checkin'
  );

  return { person, wristband_barcode: wristband.barcode, mqtt: mqttResult };
}
