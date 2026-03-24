// lib/types.js — JSDoc type definitions for PAGES frontend
// Replaces TypeScript interfaces; use @typedef for IDE support

/**
 * @typedef {Object} Child
 * @property {string} id
 * @property {string} wristbandId
 * @property {string} campId
 * @property {number} gradeLevel   — 3 or 4
 * @property {string} language     — 'si' | 'ta' | 'en'
 */

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} childId
 * @property {string} campId
 * @property {string} stage        — 'task' | 'calming' | 'content' | 'done'
 * @property {string} status       — 'active' | 'completed' | 'abandoned'
 * @property {number} startedAt    — Unix ms timestamp
 * @property {number} [completedAt]
 * @property {number} [elapsed]    — minutes elapsed
 */

/**
 * @typedef {Object} TrialResult
 * @property {number} trialIdx
 * @property {number|null} rt      — reaction time ms; null if no response
 * @property {'correct_go'|'miss'|'correct_inhibit'|'commission_error'} outcome
 */

/**
 * @typedef {Object} ScoredSession
 * @property {string} sessionId
 * @property {number} composite    — 0–1
 * @property {number} hitRate
 * @property {number} falseAlarmRate
 * @property {number} inhibitionAccuracy
 * @property {number|null} meanRT
 * @property {number|null} rtSD
 * @property {WelfareFlag[]} flags
 * @property {boolean} requiresIntervention
 */

/**
 * @typedef {Object} WelfareFlag
 * @property {'low_score'|'commission_error'|'repeated_miss'|'high_rt'|'rt_variability'|'abrupt_stop'} type
 * @property {'high'|'medium'|'low'} severity
 */

/**
 * @typedef {Object} Alert
 * @property {string} id
 * @property {string} childId
 * @property {string} campId
 * @property {string} campName
 * @property {string} campCode
 * @property {'high'|'medium'|'low'} severity
 * @property {string} flag
 * @property {string} message
 * @property {number} timestamp    — Unix ms
 * @property {'open'|'acknowledged'|'escalated'|'resolved'} status
 */

/**
 * @typedef {Object} Camp
 * @property {string} id
 * @property {string} name
 * @property {string} code
 * @property {string} location
 * @property {number} childCount
 * @property {number} sessionCount
 * @property {Alert[]} alerts
 * @property {number|null} lastSession — Unix ms
 */

/**
 * @typedef {Object} AnalyticsData
 * @property {{ id: string, name: string, scores: ScorePoint[] }[]} camps
 */

/**
 * @typedef {Object} ScorePoint
 * @property {string} date         — e.g. '2024-07-15'
 * @property {number} score        — 0–1 composite
 * @property {number} sessionCount
 */

export {}
