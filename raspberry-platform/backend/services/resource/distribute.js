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

const MAX_WATER_LITERS = 4;

/**
 * Get configured maximum water allowance (default 5L, can be overridden via distribution.json)
 */
function getMaxWaterLiters() {
  const dist = getQuantities();
  return dist.standard?.water ?? MAX_WATER_LITERS;
}

export async function distributeResource(barcode, resourceType, quantity) {
  const dist = getQuantities();
  const quantities = dist.standard;

  if (!quantities[resourceType]) {
    throw Object.assign(new Error('Invalid resource_type'), { status: 400 });
  }

  // For water, check cumulative issuance against maximum allowance
  if (resourceType === 'water') {
    const maxLiters = getMaxWaterLiters();
    
    // Calculate total water already issued to this wristband today
    const alreadyIssued = db.prepare(
      "SELECT SUM(quantity) as total FROM distributions WHERE wristband_barcode = ? AND resource_type = 'water' AND DATE(distributed_at) = DATE('now')"
    ).get(barcode).total || 0;
    
    // If adding this quantity would exceed maximum, throw error
    if ((alreadyIssued || 0) + (quantity || 0) > maxLiters) {
      throw Object.assign(new Error(`Water maximum allowance (${maxLiters}L) exceeded. Already issued: ${alreadyIssued}L, request: ${quantity}L`), { status: 400 });
    }
  }

  // For non-water resources, block duplicate distribution on the same day
  if (resourceType !== 'water') {
    const existing = db.prepare(
      "SELECT id FROM distributions WHERE wristband_barcode = ? AND resource_type = ? AND DATE(distributed_at) = DATE('now')"
    ).get(barcode, resourceType);
    if (existing) {
      throw Object.assign(new Error(`${resourceType} already distributed today.`), { status: 400 });
    }
  }

  const inserted = db.prepare('INSERT INTO distributions (wristband_barcode, resource_type, quantity) VALUES (?, ?, ?)')
    .run(barcode, resourceType, quantity || quantities[resourceType]);

  enqueueSync('distributions', inserted.lastInsertRowid);

  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ?').get(barcode);
  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(wristband.person_id);

  const given = new Set(
    db.prepare("SELECT resource_type FROM distributions WHERE wristband_barcode = ? AND DATE(distributed_at) = DATE('now')")
      .all(barcode).map(d => d.resource_type)
  );

  // Get total water issued today for this wristband
  const waterRow = db.prepare(
    "SELECT SUM(quantity) as total FROM distributions WHERE wristband_barcode = ? AND resource_type = 'water' AND DATE(distributed_at) = DATE('now')"
  ).get(barcode);
  const waterIssued = waterRow?.total || 0;
  const maxWater = getMaxWaterLiters();

  const payload = {
    event: 'distribution', person_id: person.id, person_name: person.full_name,
    barcode, resource_type: resourceType, quantity: quantity || quantities[resourceType], timestamp: new Date().toISOString(),
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
    water_issued: waterIssued,
    water_max: maxWater,
    mqtt: mqttResult,
  };
}
