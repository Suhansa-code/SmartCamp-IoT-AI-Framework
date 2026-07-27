import { campDb as db } from '../../config/database.js';

export function scanFingerprint() {
  const random = Math.random();
  if (random < 0.7) {
    const person = db.prepare(
      'SELECT * FROM persons WHERE pre_registered = 1 ORDER BY RANDOM() LIMIT 1'
    ).get();
    if (person) return { matched: true, person };
  }
  return { matched: false };
}
