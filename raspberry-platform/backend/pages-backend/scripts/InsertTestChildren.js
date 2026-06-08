import { db } from '../src/config/database.js';
import { generateChildQRCode } from '../src/services/qrCodeService.js';

async function insertTestChildren() {
  const children = [
    { child_id: 'TEST-CHILD-000260', res_id: 'TEST-RES-160', grade: 3, camp_id: 'CAMP-TEST', zone_id: 'ZONE-A', language: 'si' },
    { child_id: 'TEST-CHILD-000263', res_id: 'TEST-RES-163', grade: 4, camp_id: 'CAMP-TEST', zone_id: 'ZONE-B', language: 'ta' },
    { child_id: 'TEST-CHILD-000266', res_id: 'TEST-RES-166', grade: 3, camp_id: 'CAMP-TEST', zone_id: 'ZONE-C', language: 'en' },
  ];

  for (const child of children) {
    try {
      const qrCodeData = await generateChildQRCode(child.child_id);

      db.prepare(`
        INSERT INTO pages_children
          (child_id, res_id, grade, camp_id, zone_id, language, enrolled_at, qr_code_data)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        child.child_id,
        child.res_id,
        child.grade,
        child.camp_id,
        child.zone_id,
        child.language,
        qrCodeData
      );

      console.log(`✅ Inserted ${child.child_id} with QR code`);
    } catch (err) {
      console.error(`❌ Failed for ${child.child_id}:`, err.message);
    }
  }
}

insertTestChildren();
