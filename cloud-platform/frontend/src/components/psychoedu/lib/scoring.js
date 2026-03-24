// lib/scoring.js — Client-side signal collection and Go/No-Go scoring
// Computes psychosocial welfare signals from raw trial results

/**
 * Compute session score from trial results array.
 * @param {Array} results — array of { trialIdx, rt, outcome }
 * @param {number} totalTrials
 * @returns {Object} scored signal object
 */
export function computeScore(results, totalTrials) {
  const goTrials   = results.filter(r => r.outcome === 'correct_go' || r.outcome === 'miss')
  const noGoTrials = results.filter(r => r.outcome === 'correct_inhibit' || r.outcome === 'commission_error')

  const hits              = results.filter(r => r.outcome === 'correct_go').length
  const misses            = results.filter(r => r.outcome === 'miss').length
  const commissionErrors  = results.filter(r => r.outcome === 'commission_error').length
  const correctInhibits   = results.filter(r => r.outcome === 'correct_inhibit').length

  const hitRate           = goTrials.length > 0 ? hits / goTrials.length : 0
  const falseAlarmRate    = noGoTrials.length > 0 ? commissionErrors / noGoTrials.length : 0
  const inhibitionAccuracy= noGoTrials.length > 0 ? correctInhibits / noGoTrials.length : 1

  // Mean reaction time for correct GO responses
  const rtValues = results
    .filter(r => r.outcome === 'correct_go' && r.rt != null)
    .map(r => r.rt)
  const meanRT = rtValues.length > 0
    ? rtValues.reduce((a, b) => a + b, 0) / rtValues.length
    : null

  // RT variability (std dev) — high variability may indicate distress
  const rtSD = rtValues.length > 1
    ? Math.sqrt(rtValues.map(v => (v - meanRT) ** 2).reduce((a, b) => a + b, 0) / rtValues.length)
    : null

  // Composite welfare score (0–1); weighted blend
  const composite = (
    hitRate          * 0.4 +
    inhibitionAccuracy * 0.4 +
    (1 - falseAlarmRate) * 0.2
  )

  // Welfare flag thresholds
  const flags = []
  if (composite < 0.4)          flags.push({ type: 'low_score',       severity: 'high' })
  if (falseAlarmRate > 0.6)     flags.push({ type: 'commission_error', severity: 'high' })
  if (misses > goTrials.length * 0.6) flags.push({ type: 'repeated_miss', severity: 'medium' })
  if (meanRT && meanRT > 1000)  flags.push({ type: 'high_rt',         severity: 'medium' })
  if (rtSD && rtSD > 400)       flags.push({ type: 'rt_variability',  severity: 'low' })

  return {
    composite: Math.round(composite * 100) / 100,
    hitRate:   Math.round(hitRate * 100) / 100,
    falseAlarmRate: Math.round(falseAlarmRate * 100) / 100,
    inhibitionAccuracy: Math.round(inhibitionAccuracy * 100) / 100,
    meanRT: meanRT ? Math.round(meanRT) : null,
    rtSD:   rtSD   ? Math.round(rtSD)   : null,
    flags,
    requiresIntervention: composite < 0.5 || flags.some(f => f.severity === 'high'),
  }
}

/**
 * Determine next screen after task completion.
 * @param {Object} scored — output of computeScore
 * @returns {'calming' | 'content'}
 */
export function nextScreen(scored) {
  return scored.requiresIntervention ? 'calming' : 'content'
}

/**
 * Format a session duration in minutes and seconds.
 */
export function formatDuration(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}
