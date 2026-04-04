import axios from 'axios';
import logger from '../utils/logger.js';
import C from '../config/constants.js';
import { round, clamp } from '../utils/helpers.js';

/**
 * Fallback: compute composite score locally when Flask is unavailable.
 * Matches the formula documented in the system specification.
 *
 * @param {object} taskMetrics
 * @param {object} passiveSignals
 * @returns {{ compositeScore, taskScore, passiveScore, anomalyFlagged }}
 */
function computeLocalScore(taskMetrics, passiveSignals) {
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

  // Composite — Flask uses 0.60 / 0.40 split on fallback
  const compositeScore = (taskScore * 0.60) + (passiveScore * 0.40);

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
 * Get score from Flask ML service.
 * Falls back to local computation if Flask is unreachable or returns an error.
 *
 * @param {string} childId
 * @param {string} sessionId
 * @param {object} taskMetrics
 * @param {object} passiveSignals
 * @returns {Promise<object>} scoring result
 */
async function getScore(childId, sessionId, taskMetrics, passiveSignals) {
  try {
    const response = await axios.post(
      `${C.FLASK_URL}/score`,
      { child_id: childId, session_id: sessionId, taskMetrics, passiveSignals },
      { timeout: C.FLASK_TIMEOUT_MS }
    );

    const data = response.data;

    // Validate Flask response has the required fields
    if (
      data.compositeScore === undefined ||
      data.taskScore      === undefined ||
      data.passiveScore   === undefined
    ) {
      throw new Error('Flask returned incomplete scoring response');
    }

    logger.info(`[SCORE] Flask scored session ${sessionId}: composite=${data.compositeScore}`);

    return {
      compositeScore: round(data.compositeScore, 2),
      taskScore:      round(data.taskScore,      2),
      passiveScore:   round(data.passiveScore,   2),
      baselineScore:  data.baselineScore  || null,
      zScore:         data.zScore         || null,
      ifScore:        data.ifScore        || null,
      anomalyFlagged: data.anomalyFlagged === true,
      fallbackUsed:   false,
    };
  } catch (err) {
    logger.warn(
      `[SCORE] Flask unavailable (${err.message}) — using fallback for session ${sessionId}`
    );
    const fallback = computeLocalScore(taskMetrics, passiveSignals);
    logger.info(
      `[SCORE] Fallback scored session ${sessionId}: composite=${fallback.compositeScore}`
    );
    return fallback;
  }
}

export { getScore, computeLocalScore };