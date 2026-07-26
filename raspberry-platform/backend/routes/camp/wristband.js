import express from 'express';
import { campDb as db } from '../../config/database.js';

const router = express.Router();

router.get('/:barcode', (req, res) => {
  const { barcode } = req.params;

  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ? AND is_active = 1').get(barcode);
  if (!wristband) return res.status(404).json({ error: 'Wristband not found' });

  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(wristband.person_id);
  if (!person) return res.status(404).json({ error: 'Person not found' });

  const distributions = db.prepare(
    'SELECT resource_type FROM distributions WHERE wristband_barcode = ? AND DATE(distributed_at) = DATE("now")'
  ).all(barcode);

  const givenSet = new Set(distributions.map(d => d.resource_type));

  res.json({
    person,
    wristband_barcode: barcode,
    today_distributions: {
      breakfast: givenSet.has('breakfast'),
      lunch: givenSet.has('lunch'),
      dinner: givenSet.has('dinner'),
      water: givenSet.has('water'),
    },
  });
});

export default router;
