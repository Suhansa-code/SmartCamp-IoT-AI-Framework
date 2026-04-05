import { createError } from './errorHandler.js';

/**
 * Validate POST /api/child/enrol
 */
function validateEnrol(req, res, next) {
  const { res_id, grade, language } = req.body;

  if (!res_id || typeof res_id !== 'string' || !res_id.trim()) {
    return next(createError(400, 'res_id is required'));
  }
  if (![3, 4].includes(Number(grade))) {
    return next(createError(400, 'grade must be 3 or 4'));
  }
  if (language && !['si', 'ta', 'en'].includes(language)) {
    return next(createError(400, 'language must be si, ta, or en'));
  }

  next();
}

/**
 * Validate POST /api/session/start
 */
function validateSessionStart(req, res, next) {
  const { child_id } = req.body;

  if (!child_id || typeof child_id !== 'string' || !child_id.trim()) {
    return next(createError(400, 'child_id is required'));
  }

  const condition = req.body.condition_label;
  if (condition && !['A', 'B', 'C'].includes(condition)) {
    return next(createError(400, 'condition_label must be A, B, or C'));
  }

  next();
}

/**
 * Validate task metrics payload (shared between task-complete and second-gate)
 */
function validateTaskPayload(req, res, next) {
  const { session_id, child_id, taskMetrics, passiveSignals } = req.body;

  if (!session_id) return next(createError(400, 'session_id is required'));
  //if (!child_id)   return next(createError(400, 'child_id is required'));

  if (!taskMetrics || typeof taskMetrics !== 'object') {
    return next(createError(400, 'taskMetrics is required'));
  }

  const { accuracyRate, falseTapRate, avgReactionTime, reactionVariance } = taskMetrics;
  if (accuracyRate    === undefined) return next(createError(400, 'taskMetrics.accuracyRate is required'));
  if (falseTapRate    === undefined) return next(createError(400, 'taskMetrics.falseTapRate is required'));
  if (avgReactionTime === undefined) return next(createError(400, 'taskMetrics.avgReactionTime is required'));
  if (reactionVariance === undefined) return next(createError(400, 'taskMetrics.reactionVariance is required'));

  if (!passiveSignals || typeof passiveSignals !== 'object') {
    return next(createError(400, 'passiveSignals is required'));
  }

  const { idleTimeRatio, rapidClickCount, timeToFirstMs, completionRatio } = passiveSignals;
  if (idleTimeRatio   === undefined) return next(createError(400, 'passiveSignals.idleTimeRatio is required'));
  if (rapidClickCount === undefined) return next(createError(400, 'passiveSignals.rapidClickCount is required'));
  if (timeToFirstMs   === undefined) return next(createError(400, 'passiveSignals.timeToFirstMs is required'));
  if (completionRatio === undefined) return next(createError(400, 'passiveSignals.completionRatio is required'));

  next();
}

/**
 * Validate POST /api/session/complete
 */
function validateSessionComplete(req, res, next) {
  const { session_id, child_id, cognitiveScore, contentResponses } = req.body;

  if (!session_id)     return next(createError(400, 'session_id is required'));
  if (!child_id)       return next(createError(400, 'child_id is required'));
  if (cognitiveScore === undefined || isNaN(Number(cognitiveScore))) {
    return next(createError(400, 'cognitiveScore must be a number'));
  }
  if (!Array.isArray(contentResponses) || contentResponses.length === 0) {
    return next(createError(400, 'contentResponses must be a non-empty array'));
  }

  for (const r of contentResponses) {
    if (!r.taskId)  return next(createError(400, 'Each response requires taskId'));
    if (!['a','b','c'].includes(r.answer)) {
      return next(createError(400, `Invalid answer value: ${r.answer}`));
    }
    if (typeof r.isCorrect !== 'boolean' && r.isCorrect !== 0 && r.isCorrect !== 1) {
      return next(createError(400, 'isCorrect must be boolean'));
    }
  }

  next();
}

function validateAdminLogin(req, res, next) {
  const { username, password } = req.body;
  if (!username || !password) {
    return next(createError(400, 'username and password are required'));
  }
  next();
}

export {
  validateEnrol,
  validateSessionStart,
  validateTaskPayload,
  validateSessionComplete,
  validateAdminLogin,
};