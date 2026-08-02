import { campDb as db } from '../../config/database.js';

export function scanFingerprint() {
  const random = Math.random();
  if (random < 0.7) {
    const person = db.prepare(
      'SELECT * FROM persons WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1'
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
    WHERE p.is_active = 1 AND (p.full_name LIKE ? OR p.fingerprint_id LIKE ? OR w.barcode LIKE ?)
    ORDER BY p.created_at DESC
    LIMIT 10
  `).all(like, like, like);
}

export function linkFingerprint(personId) {
  const person = db.prepare('SELECT * FROM persons WHERE id = ? AND is_active = 1').get(personId);
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });

  const fpId = `FP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare('UPDATE persons SET fingerprint_id = ? WHERE id = ?').run(fpId, personId);

  return { ...person, fingerprint_id: fpId };
}
