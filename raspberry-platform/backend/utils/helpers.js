import { v4 as uuidv4 } from 'uuid';
import { pagesDb } from '../config/database.js';

const APP_TIME_ZONE = 'Asia/Colombo';

function getSltParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return map;
}

export function newId() {
  return uuidv4();
}

export function todayDate() {
  const p = getSltParts();
  return `${p.year}-${p.month}-${p.day}`;
}

export function nowTime() {
  const p = getSltParts();
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function nowISO() {
  const p = getSltParts();
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:30`;
}

export function campPrefix(campId) {
  const match = campId.match(/^CAMP-([A-Z])/i);
  if (match) return match[1].toUpperCase();
  return (campId.replace(/[^a-zA-Z0-9]/g, '')[0] || 'X').toUpperCase();
}

export function nextChildId(campId) {
  const prefix = campPrefix(campId);
  const row = pagesDb.prepare(
    'SELECT COUNT(*) AS cnt FROM pages_children WHERE camp_id = ?'
  ).get(campId);
  const next = (row.cnt || 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

export function round(value, places = 2) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function enqueue(tableName, recordId, operation = 'INSERT') {
  pagesDb.prepare(`
    INSERT INTO pages_sync_queue (table_name, record_id, operation, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tableName, recordId, operation, nowISO());
}
