import { db } from '../config/database.js';
import { tursoInsert, tursoUpdate, tursoRetrieve, tursoGetLastChildId } from '../config/tursoConfig.js';
import C from '../config/constants.js';
import logger from '../utils/logger.js';
import { newId, nextChildId, enqueue } from '../utils/helpers.js';
import { createError } from '../middleware/errorHandler.js';
import { checkResId } from '../config/tursoConfig.js';
 
/**
 * POST /api/child/enrol
 *
 * Creates a new child record, or returns existing if already enrolled.
 * Child ID format: camp prefix + sequential number (e.g. "B-001").
 */
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

    //Check data is in turso - #Delete when implementing
    checkResId(res_id.trim())
      .then((exists) => {
        if (!exists) {
          logger.warn(`[TURSO] res_id not found: ${res_id.trim()}`);
          // Optionally, you could return an error here instead of enrolling
          // return res.status(400).json({ success: false, message: 'res_id not found in Turso' });
        } else {
          logger.info(`[TURSO] res_id exists: ${res_id.trim()}`);
        }
      })
      .catch((err) => {
        logger.error(`[TURSO] Error checking res_id: ${err.message}`);
        // Proceed with enrolment even if Turso check fails
      });

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

    // Insert into Turso asynchronously - #delete when implementing
    tursoInsert("pages_children", {
      child_id: childId,
      res_id: res_id.trim(),
      grade: Number(grade),
      camp_id: campId,
      zone_id: zone_id,
      language: language
    })
    .catch((err) => {
      logger.warn(`[TURSO] Failed to insert child into cloud (async): ${err.message}`);
      // Non-critical error — local sync will handle it
    });

    logger.info(`[ENROL] New child enrolled: res_id=${res_id} → child_id=${childId}`);
    return res.status(201).json({
      success: true,
      child_id: childId,
      message: 'Child enrolled successfully',
      already_enrolled: false,
    });


  } catch (err) {
    next(err);
  }
}
 

async function tursoChildIdTest(req, res, next) {
  try {
    // Get Child ID from TursoDB and increase child ID by one after get latest child ID - #Delete when implementing
    let child_id = await tursoGetLastChildId();
    const newLastDigit = (parseInt(child_id.split('-').pop(), 10)) + 1;
    child_id = `TEST-CHILD-${newLastDigit.toString().padStart(6, '0')}`;

    console.log('Generated new child_id for test:', child_id);

    // Insert Child ID into TursoDB - #Delete when implementing
    await tursoInsert("pages_children", {
      child_id: child_id,
      res_id: 'TEST-RES-001',
      grade: 3,
      camp_id: 'CAMP-TEST',
      zone_id: 'ZONE-TEST',
      language: 'si',
    });

    return res.json({ success: true, child_id });
  } catch (err) {
    logger.error(`[TURSO] Failed to insert child into cloud: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to insert child into Turso' });
  }
}
/**
 * GET /api/child/:childId
 *
 * Returns child profile. Used by the frontend after QR scan.
 */
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
 
export { enrolChild, getChild, tursoChildIdTest };