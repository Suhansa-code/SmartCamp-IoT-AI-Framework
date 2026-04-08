
'use strict';
import 'dotenv/config';

const firstDefined = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const parseOrigins = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

export default {

  // ── Server ──────────────────────────────────────────────────────────────────
  PORT:         parseInt(process.env.PORT, 10)     || 3002,
  NODE_ENV:     process.env.NODE_ENV               || 'development',
  DEVICE_ID:    process.env.DEVICE_ID              || 'SCB-UNIT-01',
  CAMP_ID:      process.env.CAMP_ID                || 'CAMP-B',

  // ── Gate threshold ──────────────────────────────────────────────────────────
  // composite_score >= GATE_THRESHOLD → PASS
  // composite_score <  GATE_THRESHOLD → FAIL_FIRST
  GATE_THRESHOLD: parseFloat(process.env.GATE_THRESHOLD) || 55,

  // ── Rolling baseline ────────────────────────────────────────────────────────
  // new_baseline = old_baseline * (1 - BASELINE_ALPHA) + composite * BASELINE_ALPHA
  BASELINE_INIT:   60.0,
  BASELINE_ALPHA:  0.20,

  // ── Score weights (used by Flask — documented here for reference) ───────────
  TASK_WEIGHT:     0.50,
  PASSIVE_WEIGHT:  0.30,
  BASELINE_WEIGHT: 0.20,

  // ── Anomaly detection thresholds ────────────────────────────────────────────
  // Flask calculates z_score from session 3 onwards
  // Flask calculates if_score from session 8 onwards
  ZSCORE_THRESHOLD: -2.0,
  IF_SCORE_THRESHOLD: -0.10,

  // ── Alert rules ─────────────────────────────────────────────────────────────
  // ALERT_CONSECUTIVE: trigger if last N sessions all flagged
  // ALERT_OF_FIVE: trigger if M of last 5 sessions flagged
  ALERT_CONSECUTIVE: parseInt(process.env.ALERT_CONSECUTIVE, 10) || 3,
  ALERT_OF_FIVE:     parseInt(process.env.ALERT_OF_FIVE, 10)     || 3,

  // ── Flask ML service ────────────────────────────────────────────────────────
  FLASK_URL:    process.env.FLASK_URL || 'http://localhost:5000',
  FLASK_TIMEOUT_MS: 8000,   // 8 second timeout — fall back to local scoring

  // ── JWT ─────────────────────────────────────────────────────────────────────
  JWT_SECRET:     process.env.JWT_SECRET     || 'CHANGE_THIS_SECRET',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',

  // ── AWS ─────────────────────────────────────────────────────────────────────
  TURSO_URL: firstDefined(
    process.env.TURSO_URL,
    process.env.TURSO_DATABASE_URL,
    process.env.LIBSQL_URL,
    process.env.DATABASE_URL,
  ),
  TURSO_AUTH_TOKEN: firstDefined(
    process.env.TURSO_AUTH_TOKEN,
    process.env.TURSO_TOKEN,
    process.env.LIBSQL_AUTH_TOKEN,
    process.env.DATABASE_AUTH_TOKEN,
  ),

  // Legacy RDS settings kept for backward compatibility (unused by default)
  AWS_RDS_HOST:     process.env.AWS_RDS_HOST,
  AWS_RDS_PORT:     parseInt(process.env.AWS_RDS_PORT, 10) || 5432,
  AWS_RDS_DB:       process.env.AWS_RDS_DB       || 'pages_db',
  AWS_RDS_USER:     process.env.AWS_RDS_USER      || 'pages_user',
  AWS_RDS_PASSWORD: process.env.AWS_RDS_PASSWORD,
  AWS_S3_BUCKET:    process.env.AWS_S3_BUCKET     || 'pages-models',
  AWS_REGION:       process.env.AWS_REGION         || 'ap-south-1',

  // ── Sync ────────────────────────────────────────────────────────────────────
  SYNC_INTERVAL_MINUTES: parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 2,
  SYNC_BATCH_SIZE: 50,

  // ── CORS allowed origins ────────────────────────────────────────────────────
  CORS_ORIGINS: [
    ...parseOrigins(process.env.CORS_ORIGINS),
    ...parseOrigins(process.env.FRONTEND_URL),
    'http://192.168.4.1:3000',  // RPi production hotspot
    'http://localhost:3000',     // Development
    'http://127.0.0.1:3000',
  ].filter((origin, index, origins) => origins.indexOf(origin) === index),
  ALLOW_VERCEL_PREVIEWS: parseBoolean(process.env.ALLOW_VERCEL_PREVIEWS, true),

  // ── Gate decision labels ────────────────────────────────────────────────────
  GATE: {
    PASS:             'PASS',
    FAIL_FIRST:       'FAIL_FIRST',
    FAIL_CONFIRMED:   'FAIL_CONFIRMED',
    PASS_RECOVERED:   'PASS_RECOVERED',
  },

  // ── Alert types ─────────────────────────────────────────────────────────────
  ALERT_TYPES: {
    CONSECUTIVE: '3_consecutive_flagged',
    OF_FIVE:     '3_of_5_flagged',
  },

  // ── Sync tables — order matters (FK dependencies) ───────────────────────────
  SYNC_TABLE_ORDER: [
    'pages_children',
    'pages_sessions',
    'pages_behavioral_signals',
    'pages_gate_decisions',
    'pages_alerts',
    'pages_content_responses',
  ],

  // ── SQLite path ─────────────────────────────────────────────────────────────
  SQLITE_PATH: process.env.SQLITE_PATH || './database/pages.db',

  // ── Models directory (for Isolation Forest .pkl files) ─────────────────────
  MODELS_DIR: './models',
};