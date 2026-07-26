import express from 'express';
import { campDb as db } from '../../config/database.js';
import * as saamp from '../../services/saamp-mqtt.js';

const router = express.Router();

const QUANTITIES = { breakfast: 0.5, lunch: 0.6, dinner: 0.5, water: 15 };

router.post('/', async (req, res) => {
  const { barcode, resource_type } = req.body;
  if (!barcode || !resource_type) return res.status(400).json({ error: 'barcode and resource_type required' });
  if (!QUANTITIES[resource_type]) return res.status(400).json({ error: 'Invalid resource_type' });

  const existing = db.prepare(
    'SELECT id FROM distributions WHERE wristband_barcode = ? AND resource_type = ? AND DATE(distributed_at) = DATE("now")'
  ).get(barcode, resource_type);
  if (existing) return res.status(400).json({ error: `${resource_type} already distributed today.` });

  db.prepare('INSERT INTO distributions (wristband_barcode, resource_type, quantity) VALUES (?, ?, ?)')
    .run(barcode, resource_type, QUANTITIES[resource_type]);

  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ?').get(barcode);
  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(wristband.person_id);

  const given = new Set(
    db.prepare('SELECT resource_type FROM distributions WHERE wristband_barcode = ? AND DATE(distributed_at) = DATE("now")')
      .all(barcode).map(d => d.resource_type)
  );

  const payload = {
    event: 'distribution', person_id: person.id, person_name: person.full_name,
    barcode, resource_type, quantity: QUANTITIES[resource_type], timestamp: new Date().toISOString(),
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

  res.json({
    success: true,
    today_distributions: {
      breakfast: given.has('breakfast'), lunch: given.has('lunch'),
      dinner: given.has('dinner'), water: given.has('water'),
    },
    mqtt: mqttResult,
  });
});

export default router;
