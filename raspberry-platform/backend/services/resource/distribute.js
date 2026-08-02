import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { campDb as db } from '../../config/database.js';
import * as saamp from '../network/saamp-mqtt.js';

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

  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ?').get(barcode);
  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(wristband.person_id);

  const given = new Set(
    db.prepare("SELECT resource_type FROM distributions WHERE wristband_barcode = ? AND DATE(distributed_at) = DATE('now')")
      .all(barcode).map(d => d.resource_type)
  );

  const payload = {
    event: 'distribution', person_id: person.id, person_name: person.full_name,
    barcode, resource_type, quantity: quantities[resourceType], timestamp: new Date().toISOString(),
  };

  let mqttResult;
  if (person.mqtt_client_id && person.mqtt_password) {
    mqttResult = await saamp.publishAsClient(
      'smartcamp/distribution/log', payload,
      person.mqtt_client_id, person.mqtt_password, 'wristband_scanner', 'distribution'
    );
  } else {
    mqttResult = saamp.publish('smartcamp/distribution/log', payload, 'wristband_scanner', 'distribution');
  }

  return {
    today_distributions: {
      breakfast: given.has('breakfast'), lunch: given.has('lunch'),
      dinner: given.has('dinner'), water: given.has('water'),
    },
    mqtt: mqttResult,
  };
}
