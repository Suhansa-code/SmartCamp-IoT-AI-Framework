import axios from 'axios';
import logger from '../utils/logger.js';
import C from '../config/constants.js';
import { round, clamp } from '../utils/helpers.js';

/**
 * Fallback: compute composite score locally when Flask is unavailable.
 * Matches the formula documented in the system specification and Flask implementation.
 *
 * @param {object} taskMetrics
 * @param {object} passiveSignals
 * @param {number} baseline - Child's baseline score (default 60.0)
 * @returns {{ compositeScore, taskScore, passiveScore, anomalyFlagged }}
 */
function computeLocalScore(taskMetrics, passiveSignals, baseline = 60.0) {
  const {
    accuracyRate,
    falseTapRate,
    avgReactionTime,
    reactionVariance,
  } = taskMetrics;

  const {
    idleTimeRatio,
    rapidClickCount,
    completionRatio,
  } = passiveSignals;

  // Task score (0–100)
  const taskScore =
    (accuracyRate                              * 100 * 0.40) +
    ((1 - falseTapRate)                        * 100 * 0.30) +
    (Math.max(0, 1 - avgReactionTime / 800)    * 100 * 0.15) +
    (Math.max(0, 1 - reactionVariance / 500)   * 100 * 0.15);

  // Passive score (0–100)
  const passiveScore =
    ((1 - idleTimeRatio)                       * 100 * 0.35) +
    (Math.max(0, 1 - rapidClickCount / 10)     * 100 * 0.25) +
    (completionRatio                           * 100 * 0.40);

  // Composite = task×0.50 + passive×0.30 + baseline×0.20
  // Matches Flask compute_composite() formula
  const compositeScore = (taskScore * 0.50) + (passiveScore * 0.30) + (baseline * 0.20);

  return {
    compositeScore: round(clamp(compositeScore, 0, 100), 2),
    taskScore:      round(clamp(taskScore,      0, 100), 2),
    passiveScore:   round(clamp(passiveScore,   0, 100), 2),
    zScore:         null,
    ifScore:        null,
    anomalyFlagged: false,   // never flag anomaly on fallback — no model
    fallbackUsed:   true,
  };
}

/**
 * Check if Flask is healthy and reachable.
 * @returns {Promise<boolean>} true if Flask is ready, false otherwise
 */
async function checkFlaskHealth() {
  try {
    const response = await axios.get(
      `${C.FLASK_URL}/health`,
      { timeout: C.FLASK_TIMEOUT_MS }
    );
    const isHealthy = response.status === 200 && response.data.status === 'ok';
    if (isHealthy) {
      logger.info('[FLASK] Health check passed');
    } else {
      logger.warn('[FLASK] Health check: status not ok');
    }
    return isHealthy;
  } catch (err) {
    logger.warn(`[FLASK] Health check failed: ${err.message}`);
    return false;
  }
}

/**
 * Get score from Flask ML service.
 * Falls back to local computation if Flask is unreachable or returns an error.
 *
 * @param {string} childId
 * @param {string} sessionId
 * @param {object} taskMetrics
 * @param {object} passiveSignals
 * @param {number} baseline - Child's baseline score (default 60.0)
 * @returns {Promise<object>} scoring result
 */
async function getScore(childId, sessionId, taskMetrics, passiveSignals, baseline = 60.0) {
  try {
    logger.info(`[SCORE] Attempting to call Flask at ${C.FLASK_URL}/score for session ${sessionId}`);
    const response = await axios.post(
      `${C.FLASK_URL}/score`,
      { child_id: childId, session_id: sessionId, taskMetrics, passiveSignals },
      { timeout: C.FLASK_TIMEOUT_MS }
    );

    const data = response.data;
    logger.info(`[SCORE] Received response from Flask for session ${sessionId}: ${JSON.stringify(data)}`);

    // Validate Flask response has the required fields
    if (
      data.compositeScore === undefined ||
      data.taskScore      === undefined ||
      data.passiveScore   === undefined
    ) {
      throw new Error('Flask returned incomplete scoring response');
    }

    logger.info(
      `[SCORE] ✅ Flask scored session ${sessionId}: composite=${data.compositeScore}, ` +
      `zScore=${data.zScore}, ifScore=${data.ifScore}`
    );

    return {
      compositeScore: round(data.compositeScore, 2),
      taskScore:      round(data.taskScore,      2),
      passiveScore:   round(data.passiveScore,   2),
      baselineScore:  data.baselineScore  || baseline,
      zScore:         data.zScore         || null,
      ifScore:        data.ifScore        || null,
      anomalyFlagged: data.anomalyFlagged === true,
      fallbackUsed:   false,
    };
  } catch (err) {
    logger.warn(
      `[SCORE] ❌ Flask unavailable at ${C.FLASK_URL} (${err.code || err.message}) — using fallback for session ${sessionId}`
    );
    const fallback = computeLocalScore(taskMetrics, passiveSignals, baseline);
    logger.info(
      `[SCORE] FALLBACK scored session ${sessionId}: composite=${fallback.compositeScore}`
    );
    return fallback;
  }
}

export { getScore, computeLocalScore, checkFlaskHealth };
