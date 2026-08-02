import { campDb as db } from '../../config/database.js';

export function scanFingerprint() {
  const random = Math.random();
  if (random < 0.7) {
    // Match against ALL enrolled persons (pre-registered OR newly enrolled),
    // so returning visitors are recognised on subsequent visits.
    const person = db.prepare(
      'SELECT * FROM persons ORDER BY RANDOM() LIMIT 1'
    ).get();
    if (person) return { matched: true, person };
  }
  return { matched: false };
}

export function searchPersons(query) {
  const q = (query || '').trim();
  if (!q) return [];

  const like = `%${q}%`;
  return db.prepare(`
    SELECT p.*, w.barcode AS wristband_barcode
    FROM persons p
    LEFT JOIN wristbands w ON w.person_id = p.id AND w.is_active = 1
    WHERE p.full_name LIKE ? OR p.fingerprint_id LIKE ? OR w.barcode LIKE ?
    ORDER BY p.created_at DESC
    LIMIT 10
  `).all(like, like, like);
}

export function linkFingerprint(personId) {
  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });

  // Simulate capturing a fresh fingerprint template and binding it to the person.
  const fpId = `FP_${Date.now()}`;
  db.prepare('UPDATE persons SET fingerprint_id = ? WHERE id = ?').run(fpId, personId);

  return { ...person, fingerprint_id: fpId };
}
