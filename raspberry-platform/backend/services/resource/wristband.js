import { campDb as db } from '../../config/database.js';

export function getWristbandInfo(barcode) {
  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ? AND is_active = 1').get(barcode);
  if (!wristband) throw Object.assign(new Error('Wristband not found'), { status: 404 });

  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(wristband.person_id);
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });

  const distributions = db.prepare(
    "SELECT resource_type FROM distributions WHERE wristband_barcode = ? AND DATE(distributed_at) = DATE('now')"
  ).all(barcode);

  const givenSet = new Set(distributions.map(d => d.resource_type));

  return {
    person,
    wristband_barcode: barcode,
    today_distributions: {
      breakfast: givenSet.has('breakfast'),
      lunch: givenSet.has('lunch'),
      dinner: givenSet.has('dinner'),
      water: givenSet.has('water'),
    },
  };
}

export function getDistributionHistory(barcode, { days } = {}) {
  const wristband = db.prepare('SELECT * FROM wristbands WHERE barcode = ?').get(barcode);
  if (!wristband) throw Object.assign(new Error('Wristband not found'), { status: 404 });

  let whereClause = 'wristband_barcode = ?';
  const params = [barcode];

  if (days) {
    whereClause += " AND distributed_at >= DATE('now', ? || ' days')";
    params.push(`-${parseInt(days)}`);
  }

  const rows = db.prepare(`
    SELECT id, resource_type, quantity, distributed_at
    FROM distributions
    WHERE ${whereClause}
    ORDER BY distributed_at DESC
  `).all(...params);

  return { barcode, distributions: rows, total: rows.length };
}
