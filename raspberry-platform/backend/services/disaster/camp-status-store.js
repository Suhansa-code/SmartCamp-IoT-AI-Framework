import { disasterDb } from '../../config/database.js';
import logger from '../../utils/logger.js';

let ensureDone = false;

function ensureTable() {
  if (ensureDone) return;
  disasterDb.exec(`
    CREATE TABLE IF NOT EXISTS camp_status_overrides (
      camp_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      source TEXT DEFAULT 'cloud_admin',
      updated_at TEXT NOT NULL
    );
  `);
  ensureDone = true;
}

export function setCampStatusOverride(campId, status, source = 'cloud_admin') {
  ensureTable();
  const now = new Date().toISOString();
  disasterDb.prepare(`
    INSERT INTO camp_status_overrides (camp_id, status, source, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(camp_id) DO UPDATE SET status = excluded.status, source = excluded.source, updated_at = excluded.updated_at
  `).run(campId, status, source, now);
  logger.info(`[CAMP_STATUS] Override set: ${campId} → ${status} (source: ${source})`);
}

export function getCampStatusOverride(campId) {
  ensureTable();
  return disasterDb.prepare('SELECT status, source, updated_at FROM camp_status_overrides WHERE camp_id = ?').get(campId) || null;
}

export function getAllCampStatusOverrides() {
  ensureTable();
  const rows = disasterDb.prepare('SELECT camp_id, status, source, updated_at FROM camp_status_overrides').all();
  const map = {};
  for (const row of rows) {
    map[row.camp_id] = { status: row.status, source: row.source, updated_at: row.updated_at };
  }
  return map;
}
