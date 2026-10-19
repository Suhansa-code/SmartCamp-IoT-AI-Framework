import { pagesDb, campDb, sqliteInsert, sqliteUpdate, sqliteGetLastChildId } from '../../config/database.js';
import C from '../../config/constants.js';
import { getCampId } from '../../config/camp-id.js';
import logger from '../../utils/logger.js';
import { nextChildId, nowISO } from '../../utils/helpers.js';
import { createError } from '../../middleware/error-handler.js';
import { generateChildQRCode } from '../../services/education/qr-code.js';
import { enqueueSync } from '../../services/sync/sync-notify.js';

export async function enrolChild(req, res, next) {
  try {
    const { res_id, grade, zone_id = null, language = 'si' } = req.body;
    const campId = getCampId();

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
    });
    insertChild();

    enqueueSync('pages_children', childId);

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
      child_id, res_id: 'TEST-RES-001', grade: 3, camp_id: getCampId(),
      zone_id: 'ZONE-TEST', language: 'si', qr_code_data: qrCodeData,
    });

    return res.json({ success: true, child_id, qr_code: qrCodeData });
  } catch (err) {
    logger.error(`[DB] Failed to insert test child: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to insert test child' });
  }
}

function parseTriggerDetail(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function normalizeResId(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : String(value);
}

function lookupWristbands(resIds) {
  const ids = [...new Set(resIds.map(normalizeResId).filter(Boolean))]
    .map((id) => (Number.isFinite(Number(id)) ? Number(id) : id));
  if (!ids.length) return new Map();

  const placeholders = ids.map(() => '?').join(',');
  const rows = campDb.prepare(`
    SELECT person_id, barcode FROM wristbands
    WHERE person_id IN (${placeholders})
    ORDER BY id ASC
  `).all(...ids);

  const map = new Map();
  for (const row of rows) {
    const key = String(row.person_id);
    if (!map.has(key)) map.set(key, row.barcode);
  }
  return map;
}

export async function getChildDirectory(req, res, next) {
  try {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const rawPage = Number.parseInt(req.query.page, 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 5;
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const offset = (page - 1) * limit;

    const totalRow = pagesDb.prepare('SELECT COUNT(*) AS total FROM pages_children').get();
    const rows = pagesDb.prepare(`
      SELECT child_id, res_id, grade, camp_id, zone_id, language,
             enrolled_at, total_sessions, baseline_score,
             consecutive_low, sdq_band, alert_status, synced, qr_code_data
      FROM pages_children
      ORDER BY child_id ASC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = Number(totalRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const wristbands = lookupWristbands(rows.map((row) => row.res_id));

    return res.json({
      success: true,
      children: rows.map((row) => ({
        ...row,
        synced: Number(row.synced) || 0,
        wristband_id: wristbands.get(normalizeResId(row.res_id)) || null,
      })),
      pagination: { page, limit, total, totalPages, hasPrev: page > 1, hasNext: page < totalPages },
    });
  } catch (err) { next(err); }
}

export async function getChildEducation(req, res, next) {
  try {
    const { childId } = req.params;
    const normalizedChildId = childId.trim().toUpperCase();

    const childRow = pagesDb.prepare(`
      SELECT child_id, res_id, grade, camp_id, zone_id, language,
             enrolled_at, total_sessions, baseline_score,
             consecutive_low, sdq_band, alert_status, synced, qr_code_data
      FROM pages_children WHERE child_id = ?
    `).get(normalizedChildId);
    if (!childRow) return next(createError(404, `Child not found: ${normalizedChildId}`));

    const sessionRows = pagesDb.prepare(`
      SELECT session_id, content_session_id, session_date, session_time,
             condition_label, composite_score, task_score, passive_score,
             baseline_score_used, gate_decision, second_gate_score,
             cognitive_score, session_complete, anomaly_flagged,
             z_score, if_score, alert_triggered, synced, created_at
      FROM pages_sessions WHERE child_id = ?
      ORDER BY created_at DESC
    `).all(normalizedChildId);

    const alertRows = pagesDb.prepare(`
      SELECT alert_id, alert_type, trigger_detail, triggered_at,
             status, resolved_at, resolved_notes, synced
      FROM pages_alerts WHERE child_id = ?
      ORDER BY triggered_at DESC
    `).all(normalizedChildId);

    const alerts = alertRows.map((row) => ({
      ...row, trigger_detail: parseTriggerDetail(row.trigger_detail),
    }));

    const syncedSessions = sessionRows.filter((r) => Number(r.synced) === 1).length;
    const syncedAlerts = alertRows.filter((r) => Number(r.synced) === 1).length;
    const pendingAlerts = alertRows.filter((r) => r.status === 'pending').length;
    const resolvedAlerts = alertRows.filter((r) => r.status === 'resolved').length;

    const wristband = lookupWristbands([childRow.res_id]).get(normalizeResId(childRow.res_id)) || null;

    return res.json({
      success: true,
      child: {
        ...childRow,
        wristband_id: wristband,
        synced: Number(childRow.synced) || 0,
      },
      sessions: sessionRows,
      alerts,
      stats: {
        total_sessions: Number(childRow.total_sessions) || sessionRows.length,
        session_history_count: sessionRows.length,
        synced_sessions: syncedSessions,
        unsynced_sessions: sessionRows.length - syncedSessions,
        pending_alerts: pendingAlerts,
        resolved_alerts: resolvedAlerts,
        synced_alerts: syncedAlerts,
        unsynced_alerts: alertRows.length - syncedAlerts,
      },
    });
  } catch (err) { next(err); }
}

export async function saveLanguagePreference(req, res, next) {
  try {
    const { child_id, language } = req.body;
    if (!child_id || !language) return next(createError(400, 'child_id and language are required'));
    if (!['en', 'si', 'ta'].includes(language)) return next(createError(400, 'Invalid language code'));

    sqliteUpdate('pages_children', { language }, 'child_id = ?', [child_id]);
    enqueueSync('pages_children', child_id);
    logger.info(`[CHILD] Language preference saved for ${child_id}: ${language}`);
    return res.json({ success: true, message: `Language preference updated to ${language}`, child_id, language });
  } catch (err) { next(err); }
}

export async function getChildQRCode(req, res, next) {
  try {
    const { childId } = req.params;
    const child = pagesDb.prepare('SELECT child_id, qr_code_data FROM pages_children WHERE child_id = ?').get(childId);
    if (!child) return next(createError(404, `Child not found: ${childId}`));
    if (!child.qr_code_data) return next(createError(404, `QR code not available for child: ${childId}`));

    const html = `<!DOCTYPE html>
      <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>QR Code - ${childId}</title>
      <style>
        body { margin:0; padding:20px; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f5f5f5; font-family:Arial,sans-serif; }
        .qr-container { background:white; padding:30px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1); text-align:center; }
        .qr-container img { max-width:300px; height:auto; margin:20px 0; }
        .child-info { font-size:18px; font-weight:bold; margin-top:20px; color:#333; }
        .print-btn { margin-top:20px; padding:10px 20px; background:#0D9488; color:white; border:none; border-radius:4px; cursor:pointer; font-size:16px; }
        .print-btn:hover { background:#0a7570; }
        @media print { body { background:white; padding:0; } .print-btn { display:none; } }
      </style></head><body>
        <div class="qr-container">
          <h1>PAGES Child QR Code</h1>
          <img src="${child.qr_code_data}" alt="QR Code for ${childId}">
          <div class="child-info">Child ID: ${childId}</div>
          <button class="print-btn" onclick="window.print()">Print QR Code</button>
        </div>
      </body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
}
