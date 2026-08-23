import { pagesDb, sqliteInsert, sqliteUpdate, sqliteRetrieve, sqliteGetLastChildId, campDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { newId, todayDate, nowTime, nowISO } from '../../utils/helpers.js';
import { createError } from '../../middleware/error-handler.js';
import * as scoringService from '../../services/education/scoring.js';
import { applyFirstGate, applySecondGate, updateBaseline } from '../../services/education/gating.js';
import { checkAndCreateAlert } from '../../services/education/alert.js';
import { enqueueSync } from '../../services/sync/sync-notify.js';

function randomId() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${C.CAMP_ID}-${suffix}`;
}

function resolveChildFromPersonId(personId) {
  const trimmed = String(personId).trim();

  let childRows = sqliteRetrieve('pages_children', undefined, 'child_id = ?', [trimmed]);
  if (childRows[0]) return childRows[0];

  childRows = sqliteRetrieve('pages_children', undefined, 'res_id = ?', [trimmed]);
  if (childRows[0]) return childRows[0];

  const wristband = campDb.prepare(
    'SELECT person_id FROM wristbands WHERE qr_identifier = ? OR barcode = ?'
  ).get(trimmed, trimmed);
  if (wristband && wristband.person_id) {
    childRows = sqliteRetrieve('pages_children', undefined, 'res_id = ?', [String(wristband.person_id)]);
    if (childRows[0]) return childRows[0];
  }

  return null;
}

export async function startSession(req, res, next) {
  try {
    const { person_id, condition_label = 'A' } = req.body;

    const child = resolveChildFromPersonId(person_id);
    if (!child) return next(createError(404, `Child not found for person: ${person_id}`));

    const childId = child.child_id;

    const sessionId = newId();
    const sessionDate = todayDate();
    const sessionTime = nowTime();
    const condition = condition_label.toUpperCase();

    sqliteInsert('pages_sessions', {
      session_id: sessionId, child_id: childId, session_date: sessionDate,
      session_time: sessionTime, condition_label: condition,
      baseline_score_used: child.baseline_score, created_at: nowISO(),
    });

    enqueueSync('pages_sessions', sessionId);

    return res.status(201).json({
      success: true, session_id: sessionId, child_id: childId,
      grade: child.grade, language: child.language,
      session_number: child.total_sessions + 1,
      baseline_score: child.baseline_score,
    });
  } catch (err) { next(err); }
}

export async function taskComplete(req, res, next) {
  try {
    const { child_id, session_id, attempt = 1, taskMetrics, passiveSignals } = req.body;

    const sessionRows = sqliteRetrieve('pages_sessions', 'session_id, child_id, baseline_score_used', 'session_id = ?', [session_id]);
    const session = sessionRows[0];
    if (!session) return next(createError(404, `Session not found: ${session_id}`));

    const scoring = await scoringService.getScore(child_id, session_id, taskMetrics, passiveSignals);
    const { compositeScore, taskScore, passiveScore, zScore, ifScore } = scoring;

    let gateDecision, sessionAnomalyFlag;
    if (parseInt(attempt, 10) >= 2) {
      gateDecision = applySecondGate(compositeScore);
      sessionAnomalyFlag = gateDecision === C.GATE.FAIL_CONFIRMED;
    } else {
      gateDecision = applyFirstGate(compositeScore);
      sessionAnomalyFlag = gateDecision === C.GATE.FAIL_FIRST;
    }

    const signalId = newId();
    const decisionId = newId();

    const normalizeRate = (val, fieldName) => {
      const num = Number(val);
      if (isNaN(num)) throw new Error(`Invalid ${fieldName}: ${val}`);
      return Math.max(0, Math.min(1, num));
    };
    const normalizeNum = (val, fieldName) => {
      const num = Number(val);
      if (isNaN(num)) throw new Error(`Invalid ${fieldName}: ${val}`);
      return Math.max(0, num);
    };

    sqliteInsert('pages_behavioral_signals', {
      signal_id: signalId, session_id, child_id,
      accuracy_rate: normalizeRate(taskMetrics.accuracyRate, 'accuracyRate'),
      false_tap_rate: normalizeRate(taskMetrics.falseTapRate, 'falseTapRate'),
      avg_reaction_time: normalizeNum(taskMetrics.avgReactionTime, 'avgReactionTime'),
      reaction_variance: normalizeNum(taskMetrics.reactionVariance, 'reactionVariance'),
      idle_time_ratio: normalizeRate(passiveSignals.idleTimeRatio, 'idleTimeRatio'),
      rapid_click_count: Math.floor(Math.max(0, passiveSignals.rapidClickCount ?? 0)),
      time_to_first_ms: normalizeNum(passiveSignals.timeToFirstMs, 'timeToFirstMs'),
      completion_ratio: normalizeRate(passiveSignals.completionRatio, 'completionRatio'),
    });

    enqueueSync('pages_behavioral_signals', signalId);

    sqliteUpdate('pages_sessions', {
      composite_score: compositeScore, task_score: taskScore,
      passive_score: passiveScore, gate_decision: gateDecision,
      anomaly_flagged: sessionAnomalyFlag ? 1 : 0,
      z_score: zScore || null, if_score: ifScore || null,
    }, 'session_id = ?', [session_id]);

    sqliteInsert('pages_gate_decisions', {
      decision_id: decisionId, session_id, child_id,
      attempt_number: parseInt(attempt, 10) || 1,
      composite_score: compositeScore, decision: gateDecision,
    });

    enqueueSync('pages_gate_decisions', decisionId);

    if (parseInt(attempt, 10) >= 2 && gateDecision === C.GATE.FAIL_CONFIRMED) {
      const childRows = sqliteRetrieve('pages_children', 'consecutive_low', 'child_id = ?', [child_id]);
      const currentChild = childRows[0];
      const newConsecutiveLow = (Number(currentChild?.consecutive_low) || 0) + 1;
      sqliteUpdate('pages_children', { consecutive_low: newConsecutiveLow }, 'child_id = ?', [child_id]);
    }

    if (sessionAnomalyFlag) checkAndCreateAlert(child_id, session_id);

    return res.json({
      success: true, gate_decision: gateDecision, composite_score: compositeScore,
    });
  } catch (err) { next(err); }
}

export async function secondGate(req, res, next) {
  try {
    const { session_id, child_id, taskMetrics, passiveSignals } = req.body;

    const sessionRows = sqliteRetrieve('pages_sessions', 'session_id, gate_decision', 'session_id = ?', [session_id]);
    const session = sessionRows[0];
    const childRows = sqliteRetrieve('pages_children', 'child_id, baseline_score, consecutive_low', 'child_id = ?', [child_id]);
    const child = childRows[0];

    if (!session) return next(createError(404, `Session not found: ${session_id}`));
    if (session.gate_decision && session.gate_decision !== C.GATE.FAIL_FIRST) {
      return next(createError(400, 'Second gate only valid after FAIL_FIRST decision'));
    }
    if (!child) return next(createError(404, `Child not found: ${child_id}`));

    const scoring = await scoringService.getScore(child_id, session_id, taskMetrics, passiveSignals, child.baseline_score || 60.0);
    const { compositeScore, taskScore, passiveScore, zScore, ifScore } = scoring;
    const gateDecision = applySecondGate(compositeScore);
    const sessionAnomalyFlag = gateDecision === C.GATE.FAIL_CONFIRMED;
    const decisionId = newId();

    sqliteUpdate('pages_sessions', {
      composite_score: compositeScore, task_score: taskScore,
      passive_score: passiveScore, second_gate_score: compositeScore,
      gate_decision: gateDecision, anomaly_flagged: sessionAnomalyFlag ? 1 : 0,
      z_score: zScore ?? null, if_score: ifScore ?? null,
    }, 'session_id = ?', [session_id]);

    sqliteInsert('pages_gate_decisions', {
      decision_id: decisionId, session_id, child_id, attempt_number: 2,
      composite_score: compositeScore, decision: gateDecision, decided_at: nowISO(),
    });

    enqueueSync('pages_gate_decisions', decisionId);

    if (gateDecision === C.GATE.FAIL_CONFIRMED) {
      sqliteUpdate('pages_children', { consecutive_low: (Number(child?.consecutive_low) || 0) + 1 }, 'child_id = ?', [child_id]);
      checkAndCreateAlert(child_id, session_id);
    }

    return res.json({ success: true, gate_decision: gateDecision, composite_score: compositeScore });
  } catch (err) { next(err); }
}

export async function completeSession(req, res, next) {
  try {
    const { session_id, child_id, cognitiveScore, contentResponses = [], contentSessionId = null } = req.body;

    const sessionRows = sqliteRetrieve('pages_sessions', undefined, 'session_id = ?', [session_id]);
    const session = sessionRows[0];
    if (!session) return next(createError(404, `Session not found: ${session_id}`));

    const childRows = sqliteRetrieve('pages_children', undefined, 'child_id = ?', [child_id]);
    const child = childRows[0];
    if (!child) return next(createError(404, `Child not found: ${child_id}`));

    const compositeScore = session.composite_score || child.baseline_score;
    const newBaseline = updateBaseline(child.baseline_score, compositeScore);

    for (const r of contentResponses) {
      const responseId = newId();
      sqliteInsert('pages_content_responses', {
        response_id: responseId, session_id, child_id,
        task_id: r.taskId, selected_answer: r.answer,
        is_correct: r.isCorrect ? 1 : 0, time_taken_ms: r.timeTakenMs || 0,
        responded_at: nowISO(),
      });
      enqueueSync('pages_content_responses', responseId);
    }

    sqliteUpdate('pages_sessions', {
      cognitive_score: Number(cognitiveScore), content_session_id: contentSessionId, session_complete: 1,
      anomaly_flagged: session.anomaly_flagged,
    }, 'session_id = ?', [session_id]);

    sqliteUpdate('pages_children', {
      baseline_score: newBaseline, total_sessions: child.total_sessions + 1,
      consecutive_low: compositeScore >= C.GATE_THRESHOLD ? 0 : child.consecutive_low,
    }, 'child_id = ?', [child_id]);

    const updatedSessionRows = sqliteRetrieve('pages_sessions', 'anomaly_flagged', 'session_id = ?', [session_id]);
    const updatedSession = updatedSessionRows[0];
    if (updatedSession && updatedSession.anomaly_flagged === 1) {
      checkAndCreateAlert(child_id, session_id);
    }

    return res.json({ success: true, message: 'Session saved', new_baseline: newBaseline });
  } catch (err) { next(err); }
}

export async function getRecentSessions(req, res, next) {
  try {
    const { childId } = req.params;
    const recent = sqliteRetrieve('pages_sessions',
      'session_id, content_session_id, session_date, created_at',
      'child_id = ? AND session_complete = 1 ORDER BY created_at DESC LIMIT 3', [childId]);

    const recentLabels = recent.filter(r => r.content_session_id).map(r => r.content_session_id.replace('SESSION-', ''));
    return res.json({ success: true, recent_sessions: recent, recent_labels: recentLabels });
  } catch (err) { next(err); }
}

export async function getContentSession(req, res, next) {
  try {
    const { childId } = req.params;
    const { lang } = req.query;

    const childRows = sqliteRetrieve('pages_children', undefined, 'child_id = ?', [childId]);
    const child = childRows[0];
    if (!child) return next(createError(404, `Child not found: ${childId}`));

    const recentlyUsedRows = sqliteRetrieve('pages_sessions', 'DISTINCT content_session_id',
      'child_id = ? AND content_session_id IS NOT NULL', [childId]);
    const recentlyUsed = recentlyUsedRows.map(r => r.content_session_id);

    const languageSessionMap = { si: ['A', 'B', 'C'], ta: ['D', 'E', 'F'], en: ['G', 'H', 'I', 'J', 'K'] };
    const sessionsForLang = languageSessionMap[lang] || languageSessionMap['en'];

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
      available = sqliteRetrieve('content_sessions', 'content_session_id', whereClause, params);
    }

    let pool = available;
    if (pool.length === 0) {
      const placeholdersLabel = sessionsForLang.map(() => '?').join(',');
      pool = sqliteRetrieve('content_sessions', 'content_session_id',
        `grade_level = ? AND zeo_approved = 1 AND session_label IN (${placeholdersLabel})`,
        [child.grade, ...sessionsForLang]);
    }

    if (pool.length === 0) {
      return next(createError(404, `No approved content sessions for grade ${child.grade} and language ${lang}`));
    }

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const contentSessionId = chosen.content_session_id;

    const tasks = sqliteRetrieve('content_tasks',
      'task_id, task_order, subject, task_type, question_text, question_image, option_a, option_b, option_c, correct_answer, grade_level',
      'content_session_id = ? ORDER BY task_order ASC', [contentSessionId]);

    if (tasks.length === 0) return next(createError(404, `No tasks found for session ${contentSessionId}`));

    return res.json({ success: true, content_session_id: contentSessionId, grade: child.grade, language: lang, tasks });
  } catch (err) { next(err); }
}
