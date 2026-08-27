import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { campDb as db } from '../../config/database.js';
import * as saamp from '../network/saamp-mqtt.js';
import { enqueueSync } from '../sync/sync-notify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.join(__dirname, '..', '..', 'data', 'resource', 'distribution.json');

let _quantities = null;
function getQuantities() {
  if (!_quantities) {
    const raw = fs.readFileSync(DIST_PATH, 'utf-8');
    _quantities = JSON.parse(raw);
  }
  return _quantities;
}

export async function distributeResource(barcode, resourceType) {
  const dist = getQuantities();
  const quantities = dist.standard;

  if (!quantities[resourceType]) {
    throw Object.assign(new Error('Invalid resource_type'), { status: 400 });
  }

  const existing = db.prepare(
    "SELECT id FROM distributions WHERE wristband_barcode = ? AND resource_type = ? AND DATE(distributed_at) = DATE('now')"
  ).get(barcode, resourceType);
  if (existing) {
    throw Object.assign(new Error(`${resourceType} already distributed today.`), { status: 400 });
  }

  db.prepare('INSERT INTO distributions (wristband_barcode, resource_type, quantity) VALUES (?, ?, ?)')
    .run(barcode, resourceType, quantities[resourceType]);

  enqueueSync('distributions', barcode);

  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ?').get(barcode);
  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(wristband.person_id);

  const given = new Set(
    db.prepare("SELECT resource_type FROM distributions WHERE wristband_barcode = ? AND DATE(distributed_at) = DATE('now')")
      .all(barcode).map(d => d.resource_type)
  );

  const payload = {
    event: 'distribution', person_id: person.id, person_name: person.full_name,
    barcode, resource_type: resourceType, quantity: quantities[resourceType], timestamp: new Date().toISOString(),
  };

  // One shared broker connection for everything the Pi publishes. Per-person
  // clients cost a TLS handshake per message and an 8s timeout whenever the
  // account is missing, and they buy no isolation: the Pi holds every person's
  // password, so it can publish as anyone regardless. Attribution stays in the
  // payload, where person_id and person_name already carry it.
  const mqttResult = await saamp.publish(
    'smartcamp/distribution/log', payload, 'wristband_scanner', 'distribution');

  return {
    today_distributions: {
      breakfast: given.has('breakfast'), lunch: given.has('lunch'),
      dinner: given.has('dinner'), water: given.has('water'),
    },
    mqtt: mqttResult,
  };
}
