import { campDb } from '../config/database.js';

const DAYS = 30;
const TYPES = [
  { type: 'breakfast', quantity: 0.5, time: '07:30:00' },
  { type: 'lunch', quantity: 0.6, time: '12:30:00' },
  { type: 'dinner', quantity: 0.5, time: '18:30:00' },
  { type: 'water', quantity: 4, time: '10:00:00' },
];

const wristbands = campDb.prepare(`
  SELECT barcode
  FROM wristbands
  ORDER BY CASE WHEN person_id IS NULL THEN 1 ELSE 0 END, id
  LIMIT 4
`).all();

if (!wristbands.length) {
  throw new Error('No wristbands are available for distribution history');
}

const exists = campDb.prepare(`
  SELECT id
  FROM distributions
  WHERE wristband_barcode = ? AND resource_type = ? AND DATE(distributed_at) = ?
`);
const insert = campDb.prepare(`
  INSERT INTO distributions
    (wristband_barcode, resource_type, quantity, distributed_at, synced)
  VALUES (?, ?, ?, ?, 0)
`);

const seed = campDb.transaction(() => {
  let inserted = 0;
  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - offset);
    const date = day.toISOString().slice(0, 10);
    const attendance = Math.min(wristbands.length, 2 + (offset % 3));

    for (const { barcode } of wristbands.slice(0, attendance)) {
      for (const { type, quantity, time } of TYPES) {
        if (exists.get(barcode, type, date)) continue;
        insert.run(barcode, type, quantity, `${date} ${time}`);
        inserted += 1;
      }
    }
  }
  return inserted;
});

const inserted = seed();
const totals = campDb.prepare(`
  SELECT resource_type, COUNT(*) AS records, ROUND(SUM(quantity), 1) AS quantity
  FROM distributions
  WHERE distributed_at >= DATE('now', '-29 days')
  GROUP BY resource_type
  ORDER BY resource_type
`).all();

console.log(`[seed-distribution-history] Inserted ${inserted} pending MQTT sync records.`);
console.table(totals);
