'use strict';

import { db, sqliteInsert, sqliteGetLastChildId, sqliteRetrieveAll, sqliteCheckResId } from '../config/database.js';
import C from '../config/constants.js';
import logger from '../utils/logger.js';
import { nextChildId, enqueue , nowISO } from '../utils/helpers.js';
import { createError } from '../middleware/errorHandler.js';
import { generateChildQRCode } from '../services/qrCodeService.js';

async function enrolChild(req, res, next) {
  try {
    const {
      res_id,
      grade,
      zone_id    = null,
      language   = 'si',
    } = req.body;
 
    const campId = C.CAMP_ID;
 
    // Check if res_id already enrolled at this camp
    const existing = db.prepare(`
      SELECT child_id FROM pages_children
      WHERE  res_id = ? AND camp_id = ?
      LIMIT  1
    `).get(res_id.trim(), campId);

    //Check data is in SQLite
    const resIdExists = sqliteCheckResId(res_id.trim());
    if (!resIdExists) {
      logger.warn(`[DB] res_id not found in database: ${res_id.trim()}`);
      // Optionally, you could return an error here instead of enrolling
      // return res.status(400).json({ success: false, message: 'res_id not found in database' });
    } else {
      logger.info(`[DB] res_id exists: ${res_id.trim()}`);
    }

    if (existing) {
      logger.info(`[ENROL] Already enrolled: res_id=${res_id} → child_id=${existing.child_id}`);
      // Fetch full child record to get QR code
      const fullChild = db.prepare(`
        SELECT child_id, qr_code_data FROM pages_children WHERE child_id = ?
      `).get(existing.child_id);
      
      return res.status(200).json({
        success:          true,
        child_id:         existing.child_id,
        qr_code:          fullChild?.qr_code_data || null,
        message:          'Child already enrolled',
        already_enrolled: true,
      });
    }
 
    // Generate child_id inside a transaction to prevent race conditions
    const childId = nextChildId(campId);
    
    // Generate QR code for this child
    let qrCodeData = null;
    try {
      qrCodeData = await generateChildQRCode(childId);
      logger.info(`[ENROL] QR code generated for child: ${childId}`);
    } catch (err) {
      logger.warn(`[ENROL] QR code generation failed (non-critical): ${err.message}`);
      // Continue with enrollment even if QR code generation fails
    }
 
    const insertChild = db.transaction(() => {
      db.prepare(`
        INSERT INTO pages_children
          (child_id, res_id, grade, camp_id, zone_id, language, enrolled_at, qr_code_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(childId, res_id.trim(), Number(grade), campId, zone_id, language, nowISO(), qrCodeData);
 
      enqueue('pages_children', childId, 'INSERT');
    });
 
    insertChild();

    logger.info(`[ENROL] New child enrolled: res_id=${res_id} → child_id=${childId}`);
    return res.status(201).json({
      success: true,
      child_id: childId,
      qr_code: qrCodeData,
      message: 'Child enrolled successfully',
      already_enrolled: false,
    });


  } catch (err) {
    next(err);
  }
}
 

async function testChildIdGeneration(req, res, next) {
  try {
    // Get last Child ID from SQLite and increment
    let child_id = sqliteGetLastChildId();
    const newLastDigit = child_id ? (parseInt(child_id.split('-').pop(), 10)) + 1 : 1;
    child_id = `TEST-CHILD-${newLastDigit.toString().padStart(6, '0')}`;

    console.log('Generated new child_id for test:', child_id);
    
    // Generate QR code for test child
    let qrCodeData = null;
    try {
      qrCodeData = await generateChildQRCode(child_id);
      logger.info(`[QR] Test QR code generated for: ${child_id}`);
    } catch (err) {
      logger.warn(`[QR] Test QR code generation failed: ${err.message}`);
    }

    // Insert Child ID into SQLite
    sqliteInsert("pages_children", {
      child_id: child_id,
      res_id: 'TEST-RES-001',
      grade: 3,
      camp_id: 'CAMP-TEST',
      zone_id: 'ZONE-TEST',
      language: 'si',
      qr_code_data: qrCodeData
    });

    return res.json({ success: true, child_id, qr_code: qrCodeData });
  } catch (err) {
    logger.error(`[DB] Failed to insert test child: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to insert test child' });
  }
}
/**
 * GET /api/child/:childId
 *
 * Returns child profile. Used by the frontend after QR scan.
 */
async function getChild(req, res, next) {
  try {
    const { childId } = req.params;

    // Query SQLite directly
    const row = db.prepare(`
      SELECT
        child_id, grade, camp_id, zone_id, language,
        total_sessions, baseline_score,
        consecutive_low, alert_status, qr_code_data
      FROM pages_children
      WHERE child_id = ?
    `).get(childId.trim().toUpperCase());

    if (!row) {
      logger.warn(`[DB] Child not found: ${childId.trim().toUpperCase()}`);
      return next(createError(404, `Child not found: ${childId}`));
    }

    const child = {
      child_id: row.child_id,
      grade: row.grade,
      camp_id: row.camp_id,
      zone_id: row.zone_id,
      language: row.language,
      total_sessions: row.total_sessions,
      baseline_score: row.baseline_score,
      consecutive_low: row.consecutive_low,
      alert_status: row.alert_status,
      qr_code_data: row.qr_code_data, 
    };

    return res.json({ success: true, child });
  } catch (err) {
    logger.error(`[DB] getChild failed: ${err.message}`);
    next(err);
  }
}

function parseTriggerDetail(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function getChildDirectory(req, res, next) {
  try {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const rawPage = Number.parseInt(req.query.page, 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 5;
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const offset = (page - 1) * limit;

    const totalRow = db.prepare(`
      SELECT COUNT(*) AS total FROM pages_children
    `).get();

    const rows = db.prepare(`
      SELECT
        child_id, res_id, grade, camp_id, zone_id, language,
        enrolled_at, total_sessions, baseline_score,
        consecutive_low, sdq_band, alert_status, synced, qr_code_data
      FROM pages_children
      ORDER BY child_id ASC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = Number(totalRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      success: true,
      children: rows.map((row) => ({
        ...row,
        synced: Number(row.synced) || 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getChildEducation(req, res, next) {
  try {
    const { childId } = req.params;
    const normalizedChildId = childId.trim().toUpperCase();

    const childRow = db.prepare(`
      SELECT
        child_id, res_id, grade, camp_id, zone_id, language,
        enrolled_at, total_sessions, baseline_score,
        consecutive_low, sdq_band, alert_status, synced, qr_code_data
      FROM pages_children
      WHERE child_id = ?
    `).get(normalizedChildId);

    if (!childRow) {
      return next(createError(404, `Child not found: ${normalizedChildId}`));
    }

    const sessionRows = db.prepare(`
      SELECT
        session_id, content_session_id, session_date, session_time,
        condition_label, composite_score, task_score, passive_score,
        baseline_score_used, gate_decision, second_gate_score,
        cognitive_score, session_complete, anomaly_flagged,
        z_score, if_score, alert_triggered, synced, created_at
      FROM pages_sessions
      WHERE child_id = ?
      ORDER BY created_at DESC
    `).all(normalizedChildId);

    const alertRows = db.prepare(`
      SELECT
        alert_id, alert_type, trigger_detail, triggered_at,
        status, resolved_at, resolved_notes, synced
      FROM pages_alerts
      WHERE child_id = ?
      ORDER BY triggered_at DESC
    `).all(normalizedChildId);

    const sessions = sessionRows.map((row) => ({
      ...row,
      trigger_detail: row.trigger_detail ? parseTriggerDetail(row.trigger_detail) : undefined,
    }));

    const alerts = alertRows.map((row) => ({
      ...row,
      trigger_detail: parseTriggerDetail(row.trigger_detail),
    }));

    const syncedSessions = sessionRows.filter((row) => Number(row.synced) === 1).length;
    const syncedAlerts = alertRows.filter((row) => Number(row.synced) === 1).length;
    const pendingAlerts = alertRows.filter((row) => row.status === 'pending').length;
    const resolvedAlerts = alertRows.filter((row) => row.status === 'resolved').length;

    return res.json({
      success: true,
      child: {
        ...childRow,
        synced: Number(childRow.synced) || 0,
      },
      sessions,
      alerts,
      stats: {
        total_sessions: Number(childRow.total_sessions) || sessions.length,
        session_history_count: sessions.length,
        synced_sessions: syncedSessions,
        unsynced_sessions: sessionRows.length - syncedSessions,
        pending_alerts: pendingAlerts,
        resolved_alerts: resolvedAlerts,
        synced_alerts: syncedAlerts,
        unsynced_alerts: alertRows.length - syncedAlerts,
      },
    });
  } catch (err) {
    next(err);
  }
}

export { enrolChild, getChild, getChildDirectory, getChildEducation, testChildIdGeneration };