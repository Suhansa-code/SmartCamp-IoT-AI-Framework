'use strict';

const { v4: uuidv4 } = require('uuid');
const { db }         = require('../config/database');

const APP_TIME_ZONE = 'Asia/Colombo';

function getSltParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  return map;
}

/**
 * Generate a UUID v4.
 */
function newId() {
  return uuidv4();
}

/**
 * Generate an ISO date string for today (YYYY-MM-DD).
 */
function todayDate() {
  const p = getSltParts();
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Generate an HH:MM:SS time string for now.
 */
function nowTime() {
  const p = getSltParts();
  return `${p.hour}:${p.minute}:${p.second}`;
}

/**
 * Generate the ISO datetime string used in SQLite DEFAULT columns.
 */
function nowISO() {
  const p = getSltParts();
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:30`;
}

/**
 * Derive child_id prefix from camp_id.
 * "CAMP-B-HOMAGAMA" → "B"
 * "CAMP-A"          → "A"
 * Falls back to first char of camp_id.
 *
 * @param {string} campId
 * @returns {string} single uppercase letter
 */
function campPrefix(campId) {
  // Match the first uppercase letter after "CAMP-"
  const match = campId.match(/^CAMP-([A-Z])/i);
  if (match) return match[1].toUpperCase();
  // Fallback: first alphanumeric character
  return (campId.replace(/[^a-zA-Z0-9]/g, '')[0] || 'X').toUpperCase();
}

/**
 * Build the next child_id for a given camp.
 * Counts existing children in that camp and pads to 3 digits.
 *
 * @param {string} campId
 * @returns {string} e.g. "B-001"
 */
function nextChildId(campId) {
  const prefix = campPrefix(campId);
  const row    = db.prepare(
    'SELECT COUNT(*) AS cnt FROM pages_children WHERE camp_id = ?'
  ).get(campId);
  const next   = (row.cnt || 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

/**
 * Round a number to N decimal places.
 *
 * @param {number} value
 * @param {number} places
 * @returns {number}
 */
function round(value, places = 2) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

/**
 * Clamp a value between min and max.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Add a record to pages_sync_queue.
 * Must be called inside a db.transaction() when used with other writes.
 *
 * @param {string} tableName
 * @param {string} recordId
 * @param {string} operation  'INSERT' | 'UPDATE' | 'DELETE'
 */
function enqueue(tableName, recordId, operation = 'INSERT') {
  db.prepare(`
    INSERT INTO pages_sync_queue (table_name, record_id, operation, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tableName, recordId, operation, nowISO());
}

module.exports = {
  newId,
  todayDate,
  nowTime,
  nowISO,
  campPrefix,
  nextChildId,
  round,
  clamp,
  enqueue,
};