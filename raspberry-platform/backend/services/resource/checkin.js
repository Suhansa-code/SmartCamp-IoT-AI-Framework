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

  const mqttResult = await saamp.publish(
    'smartcamp/registration/checkin',
    {
      event: 'checkin',
      person: redactPerson(person),
      timestamp: new Date().toISOString(),
    },
    'fingerprint_scanner', 'checkin'
  );

  return { person, mqtt: mqttResult };
}
