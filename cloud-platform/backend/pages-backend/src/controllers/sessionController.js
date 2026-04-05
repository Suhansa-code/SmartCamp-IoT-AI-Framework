import { db } from '../config/database.js';
import { tursoInsert, tursoUpdate } from '../config/tursoConfig.js';
import C from '../config/constants.js';
import logger from '../utils/logger.js';
import { newId, todayDate, nowTime, nowISO, enqueue } from '../utils/helpers.js';
import { createError } from '../middleware/errorHandler.js';
import * as scoringService from '../services/scoringService.js';
import { applyFirstGate, applySecondGate, updateBaseline } from '../services/gatingService.js';
import { checkAndCreateAlert } from '../services/alertService.js';

function randomId() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${C.CAMP_ID}-${suffix}`;
}
 
// ── POST /api/session/start ───────────────────────────────────────────────────
 
function startSession(req, res, next) {
  try {
    const {
      child_id,
      condition_label = 'A',
    } = req.body;
 
    // Fetch child to get baseline + grade
    const child = db.prepare(`
      SELECT child_id, grade, language, total_sessions, baseline_score
      FROM   pages_children
      WHERE  child_id = ?
    `).get(child_id);

    //Turso DB Checking - #Delete when implementing
    checkChildId(child_id.trim())
      .then((exists) => {
        if (!exists) {
          logger.warn(`[TURSO] child_id not found: ${child_id.trim()}`);
          // Optionally, you could return an error here instead of starting session
          // return res.status(400).json({ success: false, message: 'child_id not found in Turso' });
        }
      })
      .catch((err) => {
        logger.error(`[TURSO] Error checking child_id: ${err.message}`);
        // Proceed with session start even if Turso check fails
      });

 
    if (!child) return next(createError(404, `Child not found: ${child_id}`));
 
    const sessionId     = newId();
    const sessionNumber = child.total_sessions + 1;
 
    const insertSession = db.transaction(() => {
      db.prepare(`
        INSERT INTO pages_sessions
          (session_id, child_id, session_date, session_time,
           condition_label, baseline_score_used)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        child_id,
        todayDate(),
        nowTime(),
        condition_label.toUpperCase(),
        child.baseline_score,
      );

      // tursoDB - Insert session record - #delete when implementing
      tursoInsert("pages_sessions", {
        session_id: sessionId,
        child_id,
        session_date: todayDate(),
        session_time: nowTime(),
        condition_label: condition_label.toUpperCase(),
        baseline_score_used: child.baseline_score,
      });


    });
 
    insertSession();
 
    logger.info(
      `[SESSION] Started session ${sessionId} for child ${child_id}, ` +
      `session #${sessionNumber}, condition=${condition_label}`
    );
 
    return res.status(201).json({
      success:        true,
      session_id:     sessionId,
      child_id:       child_id,
      grade:          child.grade,
      language:       child.language,
      session_number: sessionNumber,
      baseline_score: child.baseline_score,
    });
 
  } catch (err) {
    next(err);
  }
}
 
// ── POST /api/session/task-complete ──────────────────────────────────────────
 
async function taskComplete(req, res, next) {
  try {
    const { session_id, taskMetrics, passiveSignals } = req.body;
    let { child_id } = req.body;

  
// Need to Implement DB Checking for child_id in Turso - #Delete when implementing
if (!child_id) {
  child_id = randomId(); // Generate a random child_id if not provided
  logger.warn(`[SESSION] child_id not provided in taskComplete. Generated random child_id: ${child_id}`);
}


console.log('Received taskComplete for session_id:', session_id, 'child_id:', child_id);

    // Verify session exists
    /*
    const session = db.prepare(`
      SELECT session_id, child_id, baseline_score_used
      FROM   pages_sessions
      WHERE  session_id = ?
    `).get(session_id);
    if (!session) return next(createError(404, `Session not found: ${session_id}`));
    */
 
    // 1. Get score from Flask (or fallback)
    const scoring = await scoringService.getScore(
      child_id, session_id, taskMetrics, passiveSignals
    );
 
    const { compositeScore, taskScore, passiveScore, zScore, ifScore, anomalyFlagged } = scoring;
 
    // 2. Apply first gate
    const gateDecision = applyFirstGate(compositeScore);
 
    // 3. Write signals + update session + gate decision — all in one transaction
    const signalId   = newId();
    const decisionId = newId();
 
    const saveAll = db.transaction(() => {
      // Save behavioral signals
      db.prepare(`
        INSERT INTO pages_behavioral_signals
          (signal_id, session_id, child_id,
           accuracy_rate, false_tap_rate, avg_reaction_time, reaction_variance,
           idle_time_ratio, rapid_click_count, time_to_first_ms, completion_ratio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        signalId, session_id, child_id,
        taskMetrics.accuracyRate,
        taskMetrics.falseTapRate,
        taskMetrics.avgReactionTime,
        taskMetrics.reactionVariance,
        passiveSignals.idleTimeRatio,
        passiveSignals.rapidClickCount,
        passiveSignals.timeToFirstMs,
        passiveSignals.completionRatio,
      );

            // tursoDB - Insert session record - #delete when implementing
      tursoInsert("pages_behavioral_signals", {
        signal_id: signalId,
        session_id: session_id,
        child_id: child_id,
        accuracy_rate: taskMetrics.accuracyRate,
        false_tap_rate: taskMetrics.falseTapRate,
        avg_reaction_time: taskMetrics.avgReactionTime,
        reaction_variance: taskMetrics.reactionVariance,
        idle_time_ratio: passiveSignals.idleTimeRatio,
        rapid_click_count: passiveSignals.rapidClickCount,
        time_to_first_ms: passiveSignals.timeToFirstMs,
        completion_ratio: passiveSignals.completionRatio,
      }); 


 
      // Update session with scores + gate decision
      db.prepare(`
        UPDATE pages_sessions
        SET composite_score  = ?,
            task_score       = ?,
            passive_score    = ?,
            gate_decision    = ?,
            anomaly_flagged  = ?,
            z_score          = ?,
            if_score         = ?
        WHERE session_id = ?
      `).run(
        compositeScore, taskScore, passiveScore,
        gateDecision,
        anomalyFlagged ? 1 : 0,
        zScore  || null,
        ifScore || null,
        session_id,
      );

      // tursoDB - Update session record with scores + gate decision - #delete when implementing
      tursoUpdate("pages_sessions", {
        session_id: session_id,
        composite_score: compositeScore,
        task_score: taskScore,
        passive_score: passiveScore,
        gate_decision: gateDecision,
        anomaly_flagged: anomalyFlagged ? 1 : 0,
        z_score: zScore || null,
        if_score: ifScore || null
      });

      // Write gate decision record (attempt 1)
      db.prepare(`
        INSERT INTO pages_gate_decisions
          (decision_id, session_id, child_id, attempt_number, composite_score, decision)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(decisionId, session_id, child_id, compositeScore, gateDecision);
 
      //TursoDB - Insert gate decision record - #delete when implementing
      tursoInsert("pages_gate_decisions", {
        decision_id: decisionId,
        session_id: session_id,
        child_id: child_id,
        attempt_number: 1,
        composite_score: compositeScore,
        decision: gateDecision
      });



      // Enqueue signals for sync
      enqueue('pages_behavioral_signals', signalId, 'INSERT');
      enqueue('pages_gate_decisions', decisionId, 'INSERT');
    });
 
    saveAll();
 
    // 4. If anomaly flagged — run alert check (outside transaction, reads DB)
    if (anomalyFlagged) {
      checkAndCreateAlert(child_id, session_id);
    }
 
    logger.info(
      `[SESSION] Task complete: session=${session_id}, composite=${compositeScore}, ` +
      `gate=${gateDecision}, anomaly=${anomalyFlagged}`
    );
 
    // 5. Return only gate decision — never send internal ML scores
    return res.json({
      success:         true,
      gate_decision:   gateDecision,
      composite_score: compositeScore,
    });
 
  } catch (err) {
    next(err);
  }
}
 

// ── POST /api/session/second-gate ─────────────────────────────────────────────
 
async function secondGate(req, res, next) {
  try {
    const { session_id, child_id, taskMetrics, passiveSignals } = req.body;
 
    // Verify session is in FAIL_FIRST state
    const session = db.prepare(`
      SELECT session_id, gate_decision FROM pages_sessions WHERE session_id = ?
    `).get(session_id);
    if (!session) return next(createError(404, `Session not found: ${session_id}`));
    if (session.gate_decision !== C.GATE.FAIL_FIRST) {
      return next(createError(400, 'Second gate only valid after FAIL_FIRST decision'));
    }
 
    // 1. Get second score
    const scoring = await scoringService.getScore(
      child_id, session_id, taskMetrics, passiveSignals
    );
 
    const { compositeScore, taskScore, passiveScore } = scoring;
 
    // 2. Apply second gate
    const gateDecision = applySecondGate(compositeScore);
 
    const decisionId = newId();
 
    const saveSecondGate = db.transaction(() => {
      // Update session
      db.prepare(`
        UPDATE pages_sessions
        SET second_gate_score = ?,
            gate_decision     = ?
        WHERE session_id = ?
      `).run(compositeScore, gateDecision, session_id);
 
      // Write gate decision (attempt 2)
      db.prepare(`
        INSERT INTO pages_gate_decisions
          (decision_id, session_id, child_id, attempt_number, composite_score, decision)
        VALUES (?, ?, ?, 2, ?, ?)
      `).run(decisionId, session_id, child_id, compositeScore, gateDecision);
 
      // If FAIL_CONFIRMED — increment consecutive_low
      if (gateDecision === C.GATE.FAIL_CONFIRMED) {
        db.prepare(`
          UPDATE pages_children
          SET consecutive_low = consecutive_low + 1
          WHERE child_id = ?
        `).run(child_id);
      }
 
      enqueue('pages_gate_decisions', decisionId, 'INSERT');
    });
 
    saveSecondGate();
 
    logger.info(
      `[SESSION] Second gate: session=${session_id}, composite=${compositeScore}, ` +
      `decision=${gateDecision}`
    );
 
    return res.json({
      success:         true,
      gate_decision:   gateDecision,
      composite_score: compositeScore,
    });
 
  } catch (err) {
    next(err);
  }
}
 
// ── POST /api/session/complete ────────────────────────────────────────────────
 
function completeSession(req, res, next) {
  try {
    const { session_id, child_id, cognitiveScore, contentResponses } = req.body;
 
    // Fetch session for its composite_score (needed for baseline update)
    const session = db.prepare(`
      SELECT session_id, composite_score FROM pages_sessions WHERE session_id = ?
    `).get(session_id);
    if (!session) return next(createError(404, `Session not found: ${session_id}`));
 
    // Fetch current baseline
    const child = db.prepare(`
      SELECT child_id, baseline_score FROM pages_children WHERE child_id = ?
    `).get(child_id);
    if (!child) return next(createError(404, `Child not found: ${child_id}`));
 
    // Compute new baseline
    const compositeScore = session.composite_score || child.baseline_score;
    const newBaseline    = updateBaseline(child.baseline_score, compositeScore);
 
    const finalise = db.transaction(() => {
      // 1. Save content responses
      const insertResponse = db.prepare(`
        INSERT INTO pages_content_responses
          (response_id, session_id, child_id, task_id, selected_answer, is_correct, time_taken_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
 
      for (const r of contentResponses) {
        const responseId = newId();
        insertResponse.run(
          responseId,
          session_id,
          child_id,
          r.taskId,
          r.answer,
          r.isCorrect ? 1 : 0,
          r.timeTakenMs || 0,
        );
        enqueue('pages_content_responses', responseId, 'INSERT');
      }
 
      // 2. Mark session complete
      db.prepare(`
        UPDATE pages_sessions
        SET cognitive_score    = ?,
            session_complete   = 1
        WHERE session_id = ?
      `).run(Number(cognitiveScore), session_id);
 
      // 3. Update child baseline + total sessions
      db.prepare(`
        UPDATE pages_children
        SET baseline_score   = ?,
            total_sessions   = total_sessions + 1,
            consecutive_low  = CASE WHEN ? >= ? THEN 0 ELSE consecutive_low END
        WHERE child_id = ?
      `).run(
        newBaseline,
        compositeScore,
        C.GATE_THRESHOLD,
        child_id,
      );
 
      // 4. Enqueue session + children for sync
      enqueue('pages_sessions',  session_id, 'INSERT');
      enqueue('pages_children',  child_id,   'UPDATE');
    });
 
    finalise();
 
    logger.info(
      `[SESSION] Complete: session=${session_id}, cognitive=${cognitiveScore}, ` +
      `new_baseline=${newBaseline}`
    );
 
    return res.json({
      success:      true,
      message:      'Session saved',
      new_baseline: newBaseline,
    });
 
  } catch (err) {
    next(err);
  }
}
 
// ── GET /api/session/content/:childId ────────────────────────────────────────
 
function getContentSession(req, res, next) {
  try {
    const { childId } = req.params;
 
    // Get child grade
    const child = db.prepare(`
      SELECT child_id, grade FROM pages_children WHERE child_id = ?
    `).get(childId);
    if (!child) return next(createError(404, `Child not found: ${childId}`));
 
    // Get last 3 content_session_ids used by this child (to avoid repetition)
    const recentlyUsed = db.prepare(`
      SELECT DISTINCT content_session_id
      FROM   pages_sessions
      WHERE  child_id = ? AND content_session_id IS NOT NULL
      ORDER  BY created_at DESC
      LIMIT  3
    `).all(childId).map(r => r.content_session_id);
 
    // Get all approved sessions for this grade, excluding recently used
    const available = db.prepare(`
      SELECT content_session_id
      FROM   content_sessions
      WHERE  grade_level = ?
        AND  zeo_approved = 1
        AND  content_session_id NOT IN (${recentlyUsed.map(() => '?').join(',') || '\'__NONE__\''})
    `).all(child.grade, ...recentlyUsed);
 
    // If all sessions have been used recently, fall back to all approved
    const pool = available.length > 0
      ? available
      : db.prepare(`
          SELECT content_session_id
          FROM   content_sessions
          WHERE  grade_level = ? AND zeo_approved = 1
        `).all(child.grade);
 
    if (pool.length === 0) {
      return next(createError(404, `No approved content sessions for grade ${child.grade}`));
    }
 
    // Pick randomly
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const contentSessionId = chosen.content_session_id;
 
    // Get tasks — NOTE: correct_answer is excluded from response
    const tasks = db.prepare(`
      SELECT
        task_id, task_order, subject, task_type,
        question_text, question_image,
        option_a, option_b, option_c,
        grade_level
      FROM   content_tasks
      WHERE  content_session_id = ?
      ORDER  BY task_order ASC
    `).all(contentSessionId);
 
    if (tasks.length === 0) {
      return next(createError(404, `No tasks found for session ${contentSessionId}`));
    }
 
    // Record which content session this session will use
    // (session_id is not yet known here — it will be linked in task-complete if needed)
    // Frontend links it via POST /api/session/complete's session_id
 
    return res.json({
      success:             true,
      content_session_id:  contentSessionId,
      grade:               child.grade,
      tasks,
    });
 
  } catch (err) {
    next(err);
  }
}
 
async function tursoDBupdatesample(){
  try {
      const child_id = 'TEST-CHILD-123';
      tursoInsert("pages_children", {
        child_id: 123,
        res_id: 'TEST-RES-001',
        grade: 3,
        camp_id: 'CAMP-TEST',
        zone_id: 'ZONE-TEST',
      }).then(() => {
        logger.info(`[TURSO] Inserted child_id: ${child_id}`);
      }).catch((err) => {
        logger.error(`[TURSO] Error inserting child_id: ${err.message}`);
      });
    } catch (err) {      logger.error(`[TURSO] Unexpected error: ${err.message}`);

}}

export {
  startSession,
  taskComplete,
  secondGate,
  completeSession,
  getContentSession,
  tursoDBupdatesample
};