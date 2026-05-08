import { db, sqliteInsert, sqliteUpdate, sqliteRetrieve, sqliteGetLastChildId } from '../config/database.js';
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
 
//POST /api/session/start
async function startSession(req, res, next) {
  try {
    const {
      child_id,
      condition_label = 'A',
    } = req.body;
 
    // Verify Flask is healthy before allowing session start
    // const flaskHealthy = await scoringService.checkFlaskHealth();
    // if (!flaskHealthy) {
    //   return next(createError(503, 'Flask ML service is unavailable — cannot start session'));
    // }
 
    // Get child record from SQLite
    const childRows = sqliteRetrieve(
      'pages_children',
      undefined,
      'child_id = ?',
      [child_id]
    );
    const child = childRows[0];

    if (!child) return next(createError(404, `Child not found: ${child_id}`));
 
    const sessionId     = newId();
    const sessionNumber = child.total_sessions + 1;
    const sessionDate   = todayDate();
    const sessionTime   = nowTime();
    const condition     = condition_label.toUpperCase();
 
    console.log('Creating new session with ID:', sessionId, 'for child_id:', child_id);
    
    // Insert session into SQLite
    sqliteInsert("pages_sessions", {
      session_id: sessionId,
      child_id,
      session_date: sessionDate,
      session_time: sessionTime,
      condition_label: condition,
      baseline_score_used: child.baseline_score,
      created_at: nowISO()
    });
    
    // Enqueue for sync
    enqueue('pages_sessions', sessionId, 'INSERT');
 
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
 
// POST /api/session/task-complete
async function taskComplete(req, res, next) {
  try {
    const { child_id, session_id, taskMetrics, passiveSignals } = req.body;
  
        // Verify session exists
        const sessionRows = sqliteRetrieve(
          'pages_sessions',
          'session_id, child_id, baseline_score_used',
          'session_id = ?',
          [session_id]
        );
        const session = sessionRows[0];
        if (!session) return next(createError(404, `Session not found: ${session_id}`));
    
        //Create Sample taskmetrics and passiveSignals - #Delete when implementing
        // const taskMetricsSample = {
        //   accuracyRate: 0.8,
        //   falseTapRate: 0.1,
        //   avgReactionTime: 500,
        //   reactionVariance: 100,
        // };
        // const passiveSignalsSample = {
        //   idleTimeRatio: 0.2,
        //   rapidClickCount: 2,
        //   timeToFirstMs: 300,
        //   completionRatio: 0.9,
        // };

        // taskMetrics = taskMetricsSample;
        // passiveSignals = passiveSignalsSample;

        // 1. Get score from Flask (or fallback)
        const scoring = await scoringService.getScore(
          child_id, session_id, taskMetrics, passiveSignals
        );
    
        logger.info(`[SCORING] Received scores for session ${session_id}:`, scoring);
        const { compositeScore, taskScore, passiveScore, zScore, ifScore } = scoring;
    

        // 2. Apply first gate
        const gateDecision = applyFirstGate(compositeScore);
        const sessionAnomalyFlag = gateDecision === C.GATE.FAIL_FIRST;
        logger.info(`[GATING] First gate decision for session ${session_id}: ${gateDecision}`);
    
        // 3. Write signals + update session + gate decision — all in one transaction
        const signalId   = newId();
        const decisionId = newId();
    

          // Save behavioral signals
          // db.prepare(`
          //   INSERT INTO pages_behavioral_signals
          //     (signal_id, session_id, child_id,
          //     accuracy_rate, false_tap_rate, avg_reaction_time, reaction_variance,
          //     idle_time_ratio, rapid_click_count, time_to_first_ms, completion_ratio)
          //   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          // `).run(
          //   signalId, session_id, child_id,
          //   taskMetrics.accuracyRate,
          //   taskMetrics.falseTapRate,
          //   taskMetrics.avgReactionTime,
          //   taskMetrics.reactionVariance,
          //   passiveSignals.idleTimeRatio,
          //   passiveSignals.rapidClickCount,
          //   passiveSignals.timeToFirstMs,
          //   passiveSignals.completionRatio,
          // );

          console.log('Inserting behavioral signals for session_id:', session_id, 'child_id:', child_id, 'signal_id:', signalId);
          
          // Insert behavioral signals into SQLite
          sqliteInsert("pages_behavioral_signals", {
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
          
          logger.info(`[DB] Inserted behavioral signals for session ${session_id} with signal_id ${signalId}`);
          
          // Update session with scores + gate decision
          sqliteUpdate("pages_sessions", {
            composite_score: compositeScore,
            task_score: taskScore,
            passive_score: passiveScore,
            gate_decision: gateDecision,
            anomaly_flagged: sessionAnomalyFlag ? 1 : 0,
            z_score: zScore || null,
            if_score: ifScore || null
          }, 'session_id = ?', [session_id]);

          logger.info(`[DB] Updated session ${session_id} with scores and gate decision: composite=${compositeScore}, gate=${gateDecision}, anomaly=${sessionAnomalyFlag}`);

          // Write gate decision record (attempt 1)
          sqliteInsert("pages_gate_decisions", {
            decision_id: decisionId,
            session_id: session_id,
            child_id: child_id,
            attempt_number: 1,
            composite_score: compositeScore,
            decision: gateDecision
          });
          
          logger.info(`[DB] Inserted gate decision for session ${session_id} with decision_id ${decisionId}`);

          // Enqueue signals for sync
          enqueue('pages_behavioral_signals', signalId, 'INSERT');
          enqueue('pages_gate_decisions', decisionId, 'INSERT');

          logger.info(`[ENQUEUE] Enqueued behavioral_signals (${signalId}) and gate_decisions (${decisionId}) for session ${session_id}`);

    
        // 4. If anomaly flagged — run alert check (outside transaction, reads DB)
        if (sessionAnomalyFlag) {
          checkAndCreateAlert(child_id, session_id);
        }
    
        
        logger.info(
          `[SESSION] Task complete: session=${session_id}, composite=${compositeScore}, ` +
          `gate=${gateDecision}, anomaly=${sessionAnomalyFlag}`
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
 
//POST /api/session/second-gate 
async function secondGate(req, res, next) {
  try {
    const { session_id, child_id, taskMetrics, passiveSignals } = req.body;
 
    // Verify session is in FAIL_FIRST state
    const sessionRows = sqliteRetrieve(
      'pages_sessions',
      'session_id, gate_decision',
      'session_id = ?',
      [session_id]
    );
    const session = sessionRows[0];

    // Fetch child to get baseline and consecutive_low for scoring
    const childRows = sqliteRetrieve(
      'pages_children',
      'child_id, baseline_score, consecutive_low',
      'child_id = ?',
      [child_id]
    );
    const child = childRows[0];

    if (!session) return next(createError(404, `Session not found: ${session_id}`));
    if (session.gate_decision && session.gate_decision !== C.GATE.FAIL_FIRST) {
      return next(createError(400, 'Second gate only valid after FAIL_FIRST decision'));
    }
    
    if (!child) return next(createError(404, `Child not found: ${child_id}`));
    
    const childBaseline = child.baseline_score || 60.0;
 
    // 1. Get second score — pass baseline for composite calculation
    const scoring = await scoringService.getScore(
      child_id, session_id, taskMetrics, passiveSignals, childBaseline
    );
 
    const { compositeScore, taskScore, passiveScore, zScore, ifScore } = scoring;
 
    // 2. Apply second gate
    const gateDecision = applySecondGate(compositeScore);
    const sessionAnomalyFlag = gateDecision === C.GATE.FAIL_CONFIRMED;
 
    const decisionId = newId();
      // Update session
      sqliteUpdate(
        'pages_sessions',
        {
          composite_score: compositeScore,
          task_score: taskScore,
          passive_score: passiveScore,
          second_gate_score: compositeScore,
          gate_decision: gateDecision,
          anomaly_flagged: sessionAnomalyFlag ? 1 : 0,
          z_score: zScore ?? null,
          if_score: ifScore ?? null,
        },
        'session_id = ?',
        [session_id]
      );

      // Write gate decision (attempt 2)
      sqliteInsert('pages_gate_decisions', {
        decision_id: decisionId,
        session_id,
        child_id,
        attempt_number: 2,
        composite_score: compositeScore,
        decision: gateDecision,
        decided_at: nowISO(),
      });
 
      // If FAIL_CONFIRMED — increment consecutive_low
      if (gateDecision === C.GATE.FAIL_CONFIRMED) {
        sqliteUpdate(
          'pages_children',
          { consecutive_low: (Number(child?.consecutive_low) || 0) + 1 },
          'child_id = ?',
          [child_id]
        );

        checkAndCreateAlert(child_id, session_id);
      }
 
      enqueue('pages_gate_decisions', decisionId, 'INSERT');
      enqueue('pages_sessions', session_id, 'UPDATE');

 
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
 
//POST /api/session/complete 
async function completeSession(req, res, next) {
  try {
    const {
      session_id,
      child_id,
      cognitiveScore,
      contentResponses = [],
      contentSessionId = null,
    } = req.body;
 
    // Fetch session for its composite_score (needed for baseline update)
    // const session = db.prepare(`
    //   SELECT session_id, composite_score FROM pages_sessions WHERE session_id = ?
    // `).get(session_id);
    // if (!session) return next(createError(404, `Session not found: ${session_id}`));


    //Turso get session record - #delete when implementing
    const sessionRows = await tursoRetrieve(
      'pages_sessions',undefined,
      'session_id = ?',
      [session_id]
    )
    const session = sessionRows[0]
    if (!session) return next(createError(404, `Session not found: ${session_id}`));
 
    // Fetch current baseline
    // const child = db.prepare(`
    //   SELECT child_id, baseline_score FROM pages_children WHERE child_id = ?
    // `).get(child_id);
    // if (!child) return next(createError(404, `Child not found: ${child_id}`));

    // Get Turso child record    
    const childRows = sqliteRetrieve(
      'pages_children',
      undefined,
      'child_id = ?',
      [child_id]
    );
    const child = childRows[0];
    if (!child) return next(createError(404, `Child not found: ${child_id}`));
 
    // Compute new baseline
    const compositeScore = session.composite_score || child.baseline_score;
    const newBaseline    = updateBaseline(child.baseline_score, compositeScore);
    const contentRowsToSync = [];
 
      // 1. Save content responses
      // const insertResponse = db.prepare(`
      //   INSERT INTO pages_content_responses
      //     (response_id, session_id, child_id, task_id, selected_answer, is_correct, time_taken_ms,responded_at)
      //   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      // `);

      for (const r of contentResponses) {
        const responseId = newId();
        const row = {
          response_id: responseId,
          session_id,
          child_id,
          task_id: r.taskId,
          selected_answer: r.answer,
          is_correct: r.isCorrect ? 1 : 0,
          time_taken_ms: r.timeTakenMs || 0,
          responded_at: nowISO(),
        };
        sqliteInsert('pages_content_responses', row);
        contentRowsToSync.push(row);
        enqueue('pages_content_responses', responseId, 'INSERT');
      }
 
      // 2. Mark session complete
      // db.prepare(`
      //   UPDATE pages_sessions
      //   SET cognitive_score    = ?,
      //       session_complete   = 1
      //   WHERE session_id = ?
      // `).run(Number(cognitiveScore), session_id);

      // Mark session complete
      sqliteUpdate(
        'pages_sessions',
        {
          cognitive_score: Number(cognitiveScore),
          content_session_id: contentSessionId,
          session_complete: 1,
        },
        'session_id = ?',
        [session_id]
      );
      enqueue('pages_sessions', session_id, 'UPDATE');

      // 3. Update child baseline + total sessions
      // db.prepare(`
      //   UPDATE pages_children
      //   SET baseline_score   = ?,
      //       total_sessions   = total_sessions + 1,
      //       consecutive_low  = CASE WHEN ? >= ? THEN 0 ELSE consecutive_low END
      //   WHERE child_id = ?
      // Update child baseline + total sessions
      sqliteUpdate(
        'pages_children',
        {
          baseline_score: newBaseline,
          total_sessions: child.total_sessions + 1,
          consecutive_low: compositeScore >= C.GATE_THRESHOLD ? 0 : child.consecutive_low,
        },
        'child_id = ?',
        [child_id]
      );

 
      // 4. Enqueue session + children for sync
      enqueue('pages_sessions',  session_id, 'UPDATE');
      enqueue('pages_children',  child_id,   'UPDATE');
 
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
 
// GET /api/session/recent/:childId
// Returns last 3 sessions with their condition_label to avoid repetition

async function getRecentSessions(req, res, next) {
  try {
    const { childId } = req.params;

    // const recent = db.prepare(`
    //   SELECT session_id, condition_label, session_date, created_at
    //   FROM   pages_sessions
    //   WHERE  child_id = ?
    //   ORDER  BY created_at DESC
    //   LIMIT  3
    // `).all(childId);

    // Get recent sessions for child
    const recent = sqliteRetrieve(
      'pages_sessions',
      'session_id, condition_label, session_date, created_at',
      'child_id = ? ORDER BY created_at DESC LIMIT 3',
      [childId]
    );

    logger.info(
      `[SESSION] Recent sessions retrieved for child ${childId}: ` +
      `${recent.map(r => r.condition_label).join(',')}`
    );

    return res.json({
      success:          true,
      recent_sessions:  recent,
      recent_labels:    recent.map(r => r.condition_label),
    });

  } catch (err) {
    next(err);
  }
}

// GET /api/session/content/:childId 

async function getContentSession(req, res, next) {
  try {
    const { childId } = req.params;
 
    // Get child grade
    // const child = db.prepare(`
    //   SELECT child_id, grade FROM pages_children WHERE child_id = ?
    // `).get(childId);
    // if (!child) return next(createError(404, `Child not found: ${childId}`));

    // Get Turso child record - #delete when implementing
    const childRows = sqliteRetrieve(
      'pages_children',
      undefined,
      'child_id = ?',
      [childId]
    );
    const child = childRows[0];
    if (!child) return next(createError(404, `Child not found: ${childId}`));


 
    // Get last 3 content_session_ids used by this child (to avoid repetition)
    // const recentlyUsed = db.prepare(`
    //   SELECT DISTINCT content_session_id
    //   FROM   pages_sessions
    //   WHERE  child_id = ? AND content_session_id IS NOT NULL
    //   ORDER  BY created_at DESC
    //   LIMIT  3
    // `).all(childId).map(r => r.content_session_id);

    // Get recently used content sessions
    const recentlyUsedRows = sqliteRetrieve(
      'pages_sessions',
      'DISTINCT content_session_id',
      'child_id = ? AND content_session_id IS NOT NULL',
      [childId]
    );
    const recentlyUsed = recentlyUsedRows.map(r => r.content_session_id);
    
    // Get all approved sessions for this grade, excluding recently used
    const placeholders = recentlyUsed.map(() => '?').join(',') || '\'__NONE__\'';
    const available = sqliteRetrieve(
      'content_sessions',
      'content_session_id',
      `grade_level = ? AND zeo_approved = 1 AND content_session_id NOT IN (${placeholders})`,
      [child.grade, ...recentlyUsed]
    );
 
    // If all sessions have been used recently, fall back to all approved
    const pool = available.length > 0
      ? available
      : sqliteRetrieve(
          'content_sessions',
          'content_session_id',
          'grade_level = ? AND zeo_approved = 1',
          [child.grade]
        );
      
 
    if (pool.length === 0) {
      return next(createError(404, `No approved content sessions for grade ${child.grade}`));
    }
 
    // Pick randomly
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const contentSessionId = chosen.content_session_id;
 
    // Get tasks — NOTE: correct_answer is excluded from response
    // const tasks = db.prepare(`
    //   SELECT
    //     task_id, task_order, subject, task_type,
    //     question_text, question_image,
    //     option_a, option_b, option_c,
    //     grade_level
    //   FROM   content_tasks
    //   WHERE  content_session_id = ?
    //   ORDER  BY task_order ASC
    // `).all(contentSessionId);

    //turso - Get tasks for content session - #delete when implementing
    const tasks = await tursoRetrieve(
      'content_tasks',
      'task_id, task_order, subject, task_type, question_text, question_image, option_a, option_b, option_c, grade_level',
      'content_session_id = ? ORDER BY task_order ASC',
      [contentSessionId]
    );  
 
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
 
async function testDBUpdate(){
  try {
    // Get latest child_id from SQLite and create new one
    logger.info(`[DB] Fetching latest child_id from SQLite...`);
    const child_id = sqliteGetLastChildId();

    const new_child_id = `TEST-CHILD-${(parseInt(child_id.split('-').pop())+1).toString().padStart(6, '0')}`;
    const sample_session_id = newId();
    const sample_session_date = todayDate();
    const sample_session_time = nowTime();

      // Insert child into SQLite
      sqliteInsert("pages_children", {
        child_id: new_child_id,
        res_id: 'TEST-RES-001',
        grade: 3,
        camp_id: 'CAMP-TEST',
        zone_id: 'ZONE-TEST',
      });
      logger.info(`[DB] Inserted child_id: ${new_child_id}`);

      // Create a sample session so behavioral_signals FK(session_id) is valid
      sqliteInsert("pages_sessions", {
        session_id: sample_session_id,
        child_id: new_child_id,
        session_date: sample_session_date,
        session_time: sample_session_time,
        condition_label: 'A',
        baseline_score_used: 60,
      });
      logger.info(`[DB] Inserted sample session_id: ${sample_session_id} for child_id: ${new_child_id}`);

      // Sample data for behavioral signals
      sqliteInsert("pages_behavioral_signals", {
        signal_id: newId(),
        session_id: sample_session_id,
        child_id: new_child_id,
        accuracy_rate: 0.85,
        false_tap_rate: 0.15,
        avg_reaction_time: 2000,
        reaction_variance: 500,
        idle_time_ratio: 0.2,
        rapid_click_count: 5,
        time_to_first_ms: 300,
        completion_ratio: 0.9,
      });
      logger.info(`[DB] Inserted behavioral signals for child_id: ${new_child_id}`);

      return { success: true,
        message: 'Database test update completed',
      };
    } catch (err) {      
      logger.error(`[DB] Unexpected error: ${err.message}`);
      return { success: false, message: 'Failed to update database' };
    }
  }

export {
  startSession,
  taskComplete,
  secondGate,
  completeSession,
  getContentSession,
  testDBUpdate,
  getRecentSessions
};