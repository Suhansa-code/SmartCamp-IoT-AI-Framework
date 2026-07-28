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

    logger.info(`[SESSION START] Attempting to create session for child_id: ${child_id}`);
 
    // Get child record from SQLite
    const childRows = sqliteRetrieve(
      'pages_children',
      undefined,
      'child_id = ?',
      [child_id]
    );
    const child = childRows[0];

    if (!child) {
      logger.error(`[SESSION START] Child not found in database: ${child_id}`);
      logger.info(`[SESSION START] To use a child ID, first seed it with: node database/seed-test-children.js`);
      return next(createError(404, `Child not found: ${child_id}`));
    }

    logger.info(`[SESSION START] Child found: ${child_id} (Grade ${child.grade}, Language: ${child.language})`);
 
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
    const { child_id, session_id, attempt = 1, taskMetrics, passiveSignals } = req.body;
  
        // Verify session exists
        const sessionRows = sqliteRetrieve(
          'pages_sessions',
          'session_id, child_id, baseline_score_used',
          'session_id = ?',
          [session_id]
        );
        const session = sessionRows[0];
        if (!session) return next(createError(404, `Session not found: ${session_id}`));
    
        // 1. Get score from Flask (or fallback)
        const scoring = await scoringService.getScore(
          child_id, session_id, taskMetrics, passiveSignals
        );
    
        logger.info(`[SCORING] Received scores for session ${session_id}:`, scoring);
        const { compositeScore, taskScore, passiveScore, zScore, ifScore } = scoring;
    

        // 2. Apply appropriate gate based on attempt number
        // Attempt 1: first gate (PASS/FAIL_FIRST)
        // Attempt 2+: second gate (PASS_RECOVERED/FAIL_CONFIRMED)
        let gateDecision;
        let sessionAnomalyFlag;
        
        if (parseInt(attempt, 10) >= 2) {
          gateDecision = applySecondGate(compositeScore);
        } else {
          gateDecision = applyFirstGate(compositeScore);
        }

        const anomalyByGate = gateDecision === C.GATE.FAIL_FIRST
                   || gateDecision === C.GATE.FAIL_CONFIRMED;
        const anomalyByZ    = zScore  != null && zScore  < -2.0;
        const anomalyByIF   = ifScore != null && ifScore < -0.5878;
        sessionAnomalyFlag  = anomalyByGate || anomalyByZ || anomalyByIF;
        
        logger.info(`[GATING] Decision for session ${session_id} (attempt ${attempt}): ${gateDecision}`);
    
        // 3. Write signals + update session + gate decision — all in one transaction
        const signalId   = newId();
        const decisionId = newId();
    

          console.log('Inserting behavioral signals for session_id:', session_id, 'child_id:', child_id, 'signal_id:', signalId);
          console.log('[SIGNALS] Data to insert:', {
            signal_id: signalId,
            session_id: session_id,
            child_id: child_id,
            taskMetrics,
            passiveSignals
          });
          
          // Validate and normalize all values before insertion
          if (!taskMetrics || !passiveSignals) {
            throw new Error('Missing taskMetrics or passiveSignals in request body');
          }
          
          // Normalize numeric values and clamp rate values to [0, 1]
          const normalizeRate = (val, fieldName) => {
            const num = Number(val);
            if (isNaN(num)) {
              throw new Error(`Invalid ${fieldName}: ${val} (not a number)`);
            }
            // Clamp to [0, 1] for rate fields
            return Math.max(0, Math.min(1, num));
          };
          
          const normalizeNum = (val, fieldName) => {
            const num = Number(val);
            if (isNaN(num)) {
              throw new Error(`Invalid ${fieldName}: ${val} (not a number)`);
            }
            return Math.max(0, num); // Ensure non-negative
          };
          
          const accuracyRate      = normalizeRate(taskMetrics.accuracyRate, 'accuracyRate');
          const falseTapRate      = normalizeRate(taskMetrics.falseTapRate, 'falseTapRate');
          const idleTimeRatio     = normalizeRate(passiveSignals.idleTimeRatio, 'idleTimeRatio');
          const completionRatio   = normalizeRate(passiveSignals.completionRatio, 'completionRatio');
          const avgReactionTime   = normalizeNum(taskMetrics.avgReactionTime, 'avgReactionTime');
          const reactionVariance  = normalizeNum(taskMetrics.reactionVariance, 'reactionVariance');
          const rapidClickCount   = Math.floor(Math.max(0, passiveSignals.rapidClickCount ?? 0));
          const timeToFirstMs     = normalizeNum(passiveSignals.timeToFirstMs, 'timeToFirstMs');
          
          console.log('[SIGNALS] Normalized values before insert:');
          console.log(`  accuracyRate=${accuracyRate}, falseTapRate=${falseTapRate}`);
          console.log(`  avgReactionTime=${avgReactionTime}, reactionVariance=${reactionVariance}`);
          console.log(`  idleTimeRatio=${idleTimeRatio}, rapidClickCount=${rapidClickCount}`);
          console.log(`  timeToFirstMs=${timeToFirstMs}, completionRatio=${completionRatio}`);
          
          // Insert behavioral signals into SQLite
          try {
            const result = sqliteInsert("pages_behavioral_signals", {
              signal_id: signalId,
              session_id: session_id,
              child_id: child_id,
              accuracy_rate: accuracyRate,
              false_tap_rate: falseTapRate,
              avg_reaction_time: avgReactionTime,
              reaction_variance: reactionVariance,
              idle_time_ratio: idleTimeRatio,
              rapid_click_count: rapidClickCount,
              time_to_first_ms: timeToFirstMs,
              completion_ratio: completionRatio,
            });
            
            if (!result || !result.success) {
              throw new Error(`sqliteInsert returned non-success: ${JSON.stringify(result)}`);
            }
            
            logger.info(`[DB] Successfully inserted behavioral signals for session ${session_id} with signal_id ${signalId}`);
          } catch (insertErr) {
            logger.error(`[DB] Failed to insert behavioral signals: ${insertErr.message}`);
            logger.error(`[DB] Stack trace: ${insertErr.stack}`);
            throw insertErr;
          }
          
          // Update session with scores + gate decision
          // NOTE: DO NOT set session_complete here — only set it in completeSession after cognitive session
          sqliteUpdate("pages_sessions", {
            composite_score: compositeScore,
            task_score: taskScore,
            passive_score: passiveScore,
            gate_decision: gateDecision,
            anomaly_flagged: sessionAnomalyFlag ? 1 : 0,
            z_score: zScore || null,
            if_score: ifScore ?? null
          }, 'session_id = ?', [session_id]);

          logger.info(`[DB] Updated session ${session_id} with scores and gate decision: composite=${compositeScore}, gate=${gateDecision}, anomaly=${sessionAnomalyFlag}`);

          // Write gate decision record
          sqliteInsert("pages_gate_decisions", {
            decision_id: decisionId,
            session_id: session_id,
            child_id: child_id,
            attempt_number: parseInt(attempt, 10) || 1,
            composite_score: compositeScore,
            decision: gateDecision
          });
          
          logger.info(`[DB] Inserted gate decision for session ${session_id} with decision_id ${decisionId}`);

          // If attempt >= 2 and FAIL_CONFIRMED — increment consecutive_low
          if (parseInt(attempt, 10) >= 2 && gateDecision === C.GATE.FAIL_CONFIRMED) {
            const childRows = sqliteRetrieve(
              'pages_children',
              'consecutive_low',
              'child_id = ?',
              [child_id]
            );
            const currentChild = childRows[0];
            const newConsecutiveeLow = (Number(currentChild?.consecutive_low) || 0) + 1;
            
            sqliteUpdate(
              'pages_children',
              { consecutive_low: newConsecutiveeLow },
              'child_id = ?',
              [child_id]
            );
            
            logger.info(`[DB] Incremented consecutive_low for child ${child_id} to ${newConsecutiveeLow}`);
          }

          // Enqueue signals for sync
          enqueue('pages_behavioral_signals', signalId, 'INSERT');
          enqueue('pages_gate_decisions', decisionId, 'INSERT');
          enqueue('pages_sessions', session_id, 'UPDATE');
          enqueue('pages_children', child_id, 'UPDATE');

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
    const gateDecision  = applySecondGate(compositeScore);
    const anomalyByGate = gateDecision === C.GATE.FAIL_CONFIRMED;
    const anomalyByZ    = zScore  != null && zScore  < -2.0;
    const anomalyByIF   = ifScore != null && ifScore < -0.5878;
    const sessionAnomalyFlag = anomalyByGate || anomalyByZ || anomalyByIF;
 
    const decisionId = newId();
      
      // Update session with second gate scores
      // NOTE: DO NOT set session_complete here — only set it in completeSession after cognitive session
      // For FAIL_CONFIRMED, session_complete will remain 0 (session never reached cognitive stage)
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
          if_score: ifScore ?? null
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

      if (sessionAnomalyFlag) {
        sqliteUpdate(
          'pages_children',
          { consecutive_low: (Number(child?.consecutive_low) || 0) + 1 },
          'child_id = ?',
          [child_id]
        );
        enqueue('pages_children', child_id, 'UPDATE');
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

    logger.info(`[SESSION COMPLETE] Received: session_id=${session_id}, child_id=${child_id}, cognitiveScore=${cognitiveScore}, contentSessionId=${contentSessionId}`);

    // Validate required fields
    if (!session_id || !child_id) {
      logger.error(`[SESSION COMPLETE] Missing required fields: session_id=${session_id}, child_id=${child_id}`);
      return next(createError(400, 'Missing session_id or child_id'));
    }

    if (cognitiveScore === undefined || cognitiveScore === null || isNaN(Number(cognitiveScore))) {
      logger.error(`[SESSION COMPLETE] Invalid cognitiveScore: ${cognitiveScore}`);
      return next(createError(400, 'Invalid or missing cognitiveScore'));
    }

    // Fetch session record
    const sessionRows = sqliteRetrieve(
      'pages_sessions',
      undefined,
      'session_id = ?',
      [session_id]
    )
    const session = sessionRows[0]
    if (!session) {
      logger.error(`[SESSION COMPLETE] Session not found: ${session_id}`);
      return next(createError(404, `Session not found: ${session_id}`));
    }

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
      logger.info(`[SESSION COMPLETE] Updating session ${session_id} with cognitive_score=${cognitiveScore}, content_session_id=${contentSessionId}, session_complete=1`);
      
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
      logger.info(`[SESSION COMPLETE] ✅ Session ${session_id} marked as complete`);

      // 3. Update child baseline + total sessions
      logger.info(`[SESSION COMPLETE] Updating child ${child_id}: baseline=${newBaseline}, total_sessions=${child.total_sessions + 1}`);
      
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
      logger.info(`[SESSION COMPLETE] ✅ Child ${child_id} updated`);
 
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
// Returns last 3 completed sessions with their cognitive session labels to avoid repetition

async function getRecentSessions(req, res, next) {
  try {
    const { childId } = req.params;

    // Get recent COMPLETED sessions (where cognitive session was done)
    // Returns content_session_id which will be SESSION-A through SESSION-J
    const recent = sqliteRetrieve(
      'pages_sessions',
      'session_id, content_session_id, session_date, created_at',
      'child_id = ? AND session_complete = 1 ORDER BY created_at DESC LIMIT 3',
      [childId]
    );

    // Extract just the session IDs (A, B, C, etc.) from SESSION-X format
    const recentLabels = recent
      .filter(r => r.content_session_id)  // Only include completed sessions with cognitive content
      .map(r => r.content_session_id.replace('SESSION-', ''));  // Convert SESSION-A to A

    logger.info(
      `[SESSION] Recent completed sessions for child ${childId}: ` +
      `${recentLabels.join(',') || 'none'}`
    );

    return res.json({
      success:          true,
      recent_sessions:  recent,
      recent_labels:    recentLabels,  // E.g., ['A', 'B', 'C']
    });

  } catch (err) {
    next(err);
  }
}

// GET /api/session/content/:childId 

async function getContentSession(req, res, next) {
  try {
    const { childId } = req.params;
    const { lang } = req.query; // Get language from query parameter
    
    console.log('[CONTENT] Fetching content session for childId:', childId, 'lang:', lang)
 
    // Get Turso child record
    const childRows = sqliteRetrieve(
      'pages_children',
      undefined,
      'child_id = ?',
      [childId]
    );
    const child = childRows[0];
    if (!child) return next(createError(404, `Child not found: ${childId}`));
    
    // Get last 3 content_session_ids used by this child (to avoid repetition)
    const recentlyUsedRows = sqliteRetrieve(
      'pages_sessions',
      'DISTINCT content_session_id',
      'child_id = ? AND content_session_id IS NOT NULL',
      [childId]
    );
    const recentlyUsed = recentlyUsedRows.map(r => r.content_session_id);
    
    // Map language to session label patterns
    // Assumption: Sessions A,B,C are for si; D,E,F for ta; G,H,I,J,K for en
    const languageSessionMap = {
      'si': ['A', 'B', 'C'],
      'ta': ['D', 'E', 'F'],
      'en': ['G', 'H', 'I', 'J', 'K']
    };
    
    const sessionsForLang = languageSessionMap[lang] || languageSessionMap['en'];
    console.log('[CONTENT] Sessions mapped for language', lang, ':', sessionsForLang)
    
    // Get all approved sessions for this grade and language, excluding recently used
    let available = [];
    if (sessionsForLang.length > 0) {
      const placeholdersLabel = sessionsForLang.map(() => '?').join(',');
      const placeholdersExclude = recentlyUsed.map(() => '?').join(',') || "'__NONE__'";
      let whereClause = `grade_level = ? AND zeo_approved = 1 AND session_label IN (${placeholdersLabel})`;
      let params = [child.grade, ...sessionsForLang];
      
      if (recentlyUsed.length > 0) {
        whereClause += ` AND content_session_id NOT IN (${placeholdersExclude})`;
        params.push(...recentlyUsed);
      }
      
      available = sqliteRetrieve(
        'content_sessions',
        'content_session_id',
        whereClause,
        params
      );
    }
 
    // If all sessions for this language have been used recently, fall back to all approved for language
    let pool = available;
    if (pool.length === 0) {
      const placeholdersLabel = sessionsForLang.map(() => '?').join(',');
      pool = sqliteRetrieve(
        'content_sessions',
        'content_session_id',
        `grade_level = ? AND zeo_approved = 1 AND session_label IN (${placeholdersLabel})`,
        [child.grade, ...sessionsForLang]
      );
    }
      
 
    if (pool.length === 0) {
      return next(createError(404, `No approved content sessions for grade ${child.grade} and language ${lang}`));
    }
 
    // Pick randomly
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const contentSessionId = chosen.content_session_id;
 
    console.log('[CONTENT] Selected session:', contentSessionId, 'for language:', lang)
 
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
    const tasks = await sqliteRetrieve(
      'content_tasks',
      'task_id, task_order, subject, task_type, question_text, question_image, option_a, option_b, option_c, correct_answer, grade_level',
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
      language:            lang,
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

// DEBUG: GET /api/session/debug/signals/:sessionId
async function getSignalsDebug(req, res, next) {
  try {
    const { sessionId } = req.params;
    
    console.log(`[DEBUG] Fetching behavioral signals for session: ${sessionId}`);
    
    // Retrieve behavioral signals from database
    const signals = sqliteRetrieve(
      'pages_behavioral_signals',
      '*',
      'session_id = ?',
      [sessionId]
    );
    
    console.log(`[DEBUG] Query result:`, signals);
    
    if (!signals || signals.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No behavioral signals found for session ${sessionId}`,
        sessionId: sessionId,
        recordCount: 0
      });
    }
    
    return res.json({
      success: true,
      sessionId: sessionId,
      recordCount: signals.length,
      signals: signals
    });
    
  } catch (err) {
    logger.error(`[DEBUG] Error fetching signals: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

// DEBUG: POST /api/session/debug/test-signal-insert
async function testSignalInsert(req, res, next) {
  try {
    console.log('[DEBUG] Test signal insert endpoint called');
    
    // Create a test child and session first
    const testChildId = 'TEST-CHILD-' + Date.now();
    const testSessionId = 'TEST-SESSION-' + Date.now();
    
    // Create child
    console.log(`[DEBUG] Creating test child: ${testChildId}`);
    sqliteInsert('pages_children', {
      child_id: testChildId,
      res_id: 'TEST-RES-001',
      grade: 3,
      camp_id: 'TEST-CAMP',
      language: 'en',
    });
    
    // Create session
    console.log(`[DEBUG] Creating test session: ${testSessionId}`);
    sqliteInsert('pages_sessions', {
      session_id: testSessionId,
      child_id: testChildId,
      session_date: new Date().toISOString().split('T')[0],
      session_time: new Date().toTimeString().split(' ')[0],
      condition_label: 'A',
      baseline_score_used: 60.0,
    });
    
    // Insert test behavioral signals
    console.log(`[DEBUG] Inserting test behavioral signals`);
    const testSignalId = 'TEST-SIGNAL-' + Date.now();
    const insertResult = sqliteInsert('pages_behavioral_signals', {
      signal_id: testSignalId,
      session_id: testSessionId,
      child_id: testChildId,
      accuracy_rate: 0.85,
      false_tap_rate: 0.15,
      avg_reaction_time: 450,
      reaction_variance: 50,
      idle_time_ratio: 0.1,
      rapid_click_count: 2,
      time_to_first_ms: 200,
      completion_ratio: 0.85,
    });
    
    console.log(`[DEBUG] Insert result:`, insertResult);
    
    // Verify it was inserted
    const signals = sqliteRetrieve(
      'pages_behavioral_signals',
      '*',
      'signal_id = ?',
      [testSignalId]
    );
    
    console.log(`[DEBUG] Verification query result:`, signals);
    
    return res.json({
      success: true,
      message: 'Test signal inserted successfully',
      testSignalId: testSignalId,
      testSessionId: testSessionId,
      testChildId: testChildId,
      insertResult: insertResult,
      verificationResult: signals
    });
    
  } catch (err) {
    logger.error(`[DEBUG] Test insert failed: ${err.message}`);
    logger.error(`[DEBUG] Stack: ${err.stack}`);
    return res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
}

// DEBUG: List available test children
async function getAvailableTestChildren(req, res, next) {
  try {
    logger.info('[DEBUG] Fetching available test children...');
    
    const children = sqliteRetrieve(
      'pages_children',
      ['child_id', 'grade', 'language', 'baseline_score', 'total_sessions'],
      'child_id LIKE "TEST-%"',
      [],
      'child_id ASC'
    );

    const byLang = {
      si: children.filter(c => c.language === 'si'),
      ta: children.filter(c => c.language === 'ta'),
      en: children.filter(c => c.language === 'en'),
    };

    logger.info(`[DEBUG] Found ${children.length} test children`);

    return res.status(200).json({
      success: true,
      total_count: children.length,
      by_language: {
        sinhala: byLang.si,
        tamil: byLang.ta,
        english: byLang.en,
      },
      all: children,
      note: 'Use any child_id from above for /api/session/start requests'
    });
  } catch (err) {
    next(err);
  }
}

export {
  startSession,
  taskComplete,
  secondGate,
  completeSession,
  getContentSession,
  testDBUpdate,
  getRecentSessions,
  getSignalsDebug,
  testSignalInsert,
  getAvailableTestChildren
};