import logger from '../utils/logger.js';
import C from '../config/constants.js';

/**
 * Apply the first gate (initial task-complete).
 *
 * @param {number} compositeScore
 * @returns {'PASS' | 'FAIL_FIRST'}
 */
function applyFirstGate(compositeScore) {
  const decision = compositeScore >= C.GATE_THRESHOLD
    ? C.GATE.PASS
    : C.GATE.FAIL_FIRST;

  logger.info(
    `[GATE] First gate: score=${compositeScore}, threshold=${C.GATE_THRESHOLD}, decision=${decision}`
  );

  return decision;
}

/**
 * Apply the second gate (after calming activity).
 *
 * @param {number} compositeScore
 * @returns {'PASS_RECOVERED' | 'FAIL_CONFIRMED'}
 */
function applySecondGate(compositeScore) {
  const decision = compositeScore >= C.GATE_THRESHOLD
    ? C.GATE.PASS_RECOVERED
    : C.GATE.FAIL_CONFIRMED;

  logger.info(
    `[GATE] Second gate: score=${compositeScore}, threshold=${C.GATE_THRESHOLD}, decision=${decision}`
  );

  return decision;
}

/**
 * Compute the new rolling baseline after a session completes.
 *
 * Formula: new_baseline = old_baseline * 0.80 + composite_score * 0.20
 *
 * @param {number} oldBaseline
 * @param {number} compositeScore
 * @returns {number} new baseline rounded to 2 decimal places
 */
function updateBaseline(oldBaseline, compositeScore) {
  const alpha       = C.BASELINE_ALPHA;          // 0.20
  const newBaseline = oldBaseline * (1 - alpha) + compositeScore * alpha;
  return Math.round(newBaseline * 100) / 100;
}

export { applyFirstGate, applySecondGate, updateBaseline };