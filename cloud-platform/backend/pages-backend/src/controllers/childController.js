'use strict';
 
const { db }         = require('../config/database');
const C              = require('../config/constants');
const logger         = require('../utils/logger');
const { newId, nextChildId, enqueue } = require('../utils/helpers');
const { createError } = require('../middleware/errorHandler');
 

function enrolChild(req, res, next) {
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
 
    if (existing) {
      logger.info(`[ENROL] Already enrolled: res_id=${res_id} → child_id=${existing.child_id}`);
      return res.status(200).json({
        success:          true,
        child_id:         existing.child_id,
        message:          'Child already enrolled',
        already_enrolled: true,
      });
    }
 
    // Generate child_id inside a transaction to prevent race conditions
    const childId = nextChildId(campId);
 
    const insertChild = db.transaction(() => {
      db.prepare(`
        INSERT INTO pages_children
          (child_id, res_id, grade, camp_id, zone_id, language)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(childId, res_id.trim(), Number(grade), campId, zone_id, language);
 
      enqueue('pages_children', childId, 'INSERT');
    });
 
    insertChild();
 
    logger.info(`[ENROL] Enrolled child_id=${childId}, res_id=${res_id}, grade=${grade}, camp=${campId}`);
 
    return res.status(201).json({
      success:          true,
      child_id:         childId,
      message:          'Child enrolled successfully',
      already_enrolled: false,
    });
 
  } catch (err) {
    next(err);
  }
}
 
// Returns child profile. Used by the frontend after QR scan.
function getChild(req, res, next) {
  try {
    const { childId } = req.params;
 
    const child = db.prepare(`
      SELECT
        child_id, grade, camp_id, language,
        total_sessions, baseline_score,
        consecutive_low, alert_status
      FROM pages_children
      WHERE child_id = ?
    `).get(childId);
 
    if (!child) {
      return next(createError(404, `Child not found: ${childId}`));
    }
 
    return res.json({ success: true, child });
 
  } catch (err) {
    next(err);
  }
}
 
module.exports = { enrolChild, getChild };