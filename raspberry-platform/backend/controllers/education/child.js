import { pagesDb, sqliteInsert, sqliteGetLastChildId } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nextChildId, enqueue, nowISO } from '../../utils/helpers.js';
import { createError } from '../../middleware/error-handler.js';
import { generateChildQRCode } from '../../services/education/qr-code.js';

export async function enrolChild(req, res, next) {
  try {
    const { res_id, grade, zone_id = null, language = 'si' } = req.body;
    const campId = C.CAMP_ID;

    const existing = pagesDb.prepare(
      'SELECT child_id, qr_code_data FROM pages_children WHERE res_id = ? AND camp_id = ? LIMIT 1'
    ).get(res_id.trim(), campId);

    if (existing) {
      return res.status(200).json({
        success: true, child_id: existing.child_id,
        qr_code: existing.qr_code_data || null,
        message: 'Child already enrolled', already_enrolled: true,
      });
    }

    const childId = nextChildId(campId);

    let qrCodeData = null;
    try { qrCodeData = await generateChildQRCode(childId); } catch (err) {
      logger.warn(`[ENROL] QR code generation failed (non-critical): ${err.message}`);
    }

    const insertChild = pagesDb.transaction(() => {
      pagesDb.prepare(`
        INSERT INTO pages_children (child_id, res_id, grade, camp_id, zone_id, language, enrolled_at, qr_code_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(childId, res_id.trim(), Number(grade), campId, zone_id, language, nowISO(), qrCodeData);
      enqueue('pages_children', childId, 'INSERT');
    });
    insertChild();

    return res.status(201).json({
      success: true, child_id: childId, qr_code: qrCodeData,
      message: 'Child enrolled successfully', already_enrolled: false,
    });
  } catch (err) { next(err); }
}

export async function getChild(req, res, next) {
  try {
    const { childId } = req.params;
    const row = pagesDb.prepare(`
      SELECT child_id, grade, camp_id, zone_id, language, total_sessions,
             baseline_score, consecutive_low, alert_status, qr_code_data
      FROM pages_children WHERE child_id = ?
    `).get(childId.trim().toUpperCase());

    if (!row) return next(createError(404, `Child not found: ${childId}`));

    return res.json({ success: true, child: row });
  } catch (err) { next(err); }
}

export async function testChildIdGeneration(req, res, next) {
  try {
    let child_id = sqliteGetLastChildId();
    const newLastDigit = child_id ? (parseInt(child_id.split('-').pop(), 10)) + 1 : 1;
    child_id = `TEST-CHILD-${newLastDigit.toString().padStart(6, '0')}`;

    let qrCodeData = null;
    try { qrCodeData = await generateChildQRCode(child_id); } catch (err) {
      logger.warn(`[QR] Test QR code generation failed: ${err.message}`);
    }

    sqliteInsert('pages_children', {
      child_id, res_id: 'TEST-RES-001', grade: 3, camp_id: 'CAMP-TEST',
      zone_id: 'ZONE-TEST', language: 'si', qr_code_data: qrCodeData,
    });

    return res.json({ success: true, child_id, qr_code: qrCodeData });
  } catch (err) {
    logger.error(`[DB] Failed to insert test child: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to insert test child' });
  }
}
