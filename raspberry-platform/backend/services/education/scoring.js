import axios from 'axios';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { round } from '../../utils/helpers.js';
import { sqliteRetrieve } from '../../config/database.js';

const flaskUrl = C.FLASK_URL;

const ZSCORE_MIN_SESSIONS = 3;

export async function computeLocalZScore(childId, compositeScore) {
  try {
    const rows = sqliteRetrieve(
      'pages_sessions',
      'composite_score',
      'child_id = ? AND composite_score IS NOT NULL',
      [childId]
    );

    const scores = rows
      .map((r) => Number(r.composite_score))
      .filter((n) => Number.isFinite(n));

    if (scores.length < ZSCORE_MIN_SESSIONS - 1) return null;

    const meanScore = scores.reduce((sum, n) => sum + n, 0) / scores.length;
    const varianceScore = scores.reduce((sum, n) => sum + (n - meanScore) ** 2, 0) / scores.length;
    const stdDev = varianceScore > 0 ? Math.sqrt(varianceScore) : 1;
    const z = (compositeScore - meanScore) / stdDev;

    return round(z < 0 ? Math.max(z, -5) : z, 4);
  } catch (err) {
    logger.warn(`[SCORING] Local z-score computation failed for child ${childId}: ${err.message}`);
    return null;
  }
}

export async function checkFlaskHealth() {
  try {
    const res = await axios.get(`${flaskUrl}/health`, { timeout: 3000 });
    return res.data?.status === 'ok';
  } catch { return false; }
}

export async function getScore(childId, sessionId, taskMetrics, passiveSignals, baselineOverride = null) {
  const body = { child_id: childId, session_id: sessionId, taskMetrics, passiveSignals };

  try {
    const res = await axios.post(`${flaskUrl}/score`, body, {
      timeout: C.FLASK_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });
    const d = res.data;
    const localZScore = await computeLocalZScore(childId, d.compositeScore);
    const ifScore = d.ifScore ?? null;
    const anomalyByZ = localZScore !== null && localZScore < C.ZSCORE_THRESHOLD;
    const anomalyByIF = ifScore !== null && ifScore < C.IF_SCORE_THRESHOLD;
    return {
      compositeScore: round(d.compositeScore, 2),
      taskScore: round(d.taskScore, 2),
      passiveScore: round(d.passiveScore, 2),
      baselineScore: d.baselineScore || null,
      zScore: localZScore,
      ifScore,
      anomalyFlagged: anomalyByZ || anomalyByIF,
      gateDecision: d.gateDecision,
    };
  } catch (err) {
    logger.warn(`[SCORING] Flask unreachable — using fallback scoring: ${err.message}`);
    const fallback = fallbackScore(taskMetrics, passiveSignals, baselineOverride);
    const localZScore = await computeLocalZScore(childId, fallback.compositeScore);
    const anomalyByZ = localZScore !== null && localZScore < C.ZSCORE_THRESHOLD;
    return {
      ...fallback,
      zScore: localZScore,
      anomalyFlagged: anomalyByZ,
    };
  }
}

export function fallbackScore(taskMetrics, passiveSignals, baselineOverride = null) {
  try {
    const taskScore = computeTaskScore(taskMetrics);
    const passiveScore = computePassiveScore(passiveSignals);
    const baseline = baselineOverride !== null ? baselineOverride : C.BASELINE_INIT;
    const compositeScore = taskScore * C.TASK_WEIGHT + passiveScore * C.PASSIVE_WEIGHT + baseline * C.BASELINE_WEIGHT;

    return {
      compositeScore: Math.round(Math.min(Math.max(compositeScore, 0), 100) * 100) / 100,
      taskScore: Math.round(taskScore * 100) / 100,
      passiveScore: Math.round(passiveScore * 100) / 100,
      baselineScore: baseline,
      zScore: null,
      ifScore: null,
      anomalyFlagged: false,
      gateDecision: compositeScore >= C.GATE_THRESHOLD ? 'PASS' : 'FAIL_FIRST',
    };
  } catch (err) {
    logger.error(`[SCORING] Fallback error: ${err.message}`);
    return {
      compositeScore: 50, taskScore: 50, passiveScore: 50,
      baselineScore: C.BASELINE_INIT, zScore: null, ifScore: null,
      anomalyFlagged: false, gateDecision: 'PASS',
    };
  }
}

export function computeTaskScore(taskMetrics) {
  const accuracyRate = taskMetrics.accuracyRate ?? 0;
  const falseTapRate = taskMetrics.falseTapRate ?? 0;
  const avgReactionTime = taskMetrics.avgReactionTime ?? 800;
  const reactionVariance = taskMetrics.reactionVariance ?? 500;

  return (
    accuracyRate * 100 * 0.40 +
    (1 - falseTapRate) * 100 * 0.30 +
    Math.max(0, 1 - avgReactionTime / 800) * 100 * 0.15 +
    Math.max(0, 1 - reactionVariance / 500) * 100 * 0.15
  );
}

export function computePassiveScore(passiveSignals) {
  const idleTimeRatio = passiveSignals.idleTimeRatio ?? 0;
  const rapidClickCount = passiveSignals.rapidClickCount ?? 0;
  const completionRatio = passiveSignals.completionRatio ?? 1;

  return (
    (1 - idleTimeRatio) * 100 * 0.35 +
    Math.max(0, 1 - rapidClickCount / 10) * 100 * 0.25 +
    completionRatio * 100 * 0.40
  );
}
