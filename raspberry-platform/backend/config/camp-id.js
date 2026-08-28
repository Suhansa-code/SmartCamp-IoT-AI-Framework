/**
 * camp-id.js — Centralized CAMP_ID management with disk persistence.
 *
 * Derivation:
 *   - GPS location name first letter → "CAMP-H" (for "Homagama")
 *   - Fallback before GPS: DEVICE_ID (e.g., "SCB-UNIT-01")
 *
 * Persistence:
 *   - GPS-derived CAMP_ID is saved to db/camp-id.json
 *   - On boot, loads from file before GPS is available
 *   - This means CAMP_ID is correct immediately after restart
 *
 * Record update:
 *   - When CAMP_ID changes, all local SQLite records are updated
 *   - Sync manager picks up changes on next cycle
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import C from './constants.js';
import logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '../db/camp-id.json');

let _campId = C.DEVICE_ID;
let _gpsDerived = false;
let _locationName = null;

// ── Load persisted state on startup ──────────────────────────────────────
loadPersistedState();

function loadPersistedState() {
  try {
    if (existsSync(STATE_FILE)) {
      const data = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      if (data.camp_id) {
        _campId = data.camp_id;
        _gpsDerived = true;
        _locationName = data.location_name || null;
        logger.info(`[CAMP-ID] Loaded from disk: ${_campId} (location: ${_locationName || 'unknown'})`);
      }
    }
  } catch (err) {
    logger.debug(`[CAMP-ID] No persisted state found: ${err.message}`);
  }
}

function persistState() {
  try {
    const dir = dirname(STATE_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify({
      camp_id: _campId,
      location_name: _locationName,
      derived_at: new Date().toISOString(),
    }, null, 2));
  } catch (err) {
    logger.error(`[CAMP-ID] Failed to persist state: ${err.message}`);
  }
}

/**
 * Derive a CAMP-ID from a GPS location name.
 *   "Homagama" → "CAMP-H"
 *   "Baddegama" → "CAMP-B"
 */
export function deriveCampId(locationName) {
  if (!locationName || typeof locationName !== 'string') return null;
  const first = locationName.trim().charAt(0);
  if (!first || !/[a-zA-Z]/.test(first)) return null;
  return `CAMP-${first.toUpperCase()}`;
}

/**
 * Get the current CAMP_ID (always in-memory, no disk read).
 */
export function getCampId() {
  return _campId;
}

export function isGpsDerived() {
  return _gpsDerived;
}

export function getLocationName() {
  return _locationName;
}

/**
 * Update CAMP_ID from a GPS location name.
 * Persists to disk and updates local SQLite records if CAMP_ID changed.
 */
export function updateCampIdFromGps(locationName) {
  const derived = deriveCampId(locationName);
  if (!derived) return null;

  // Already derived from same location — no-op
  if (derived === _campId && _gpsDerived) return _campId;

  const oldCampId = _campId;
  _campId = derived;
  _gpsDerived = true;
  _locationName = locationName;

  logger.info(`[CAMP-ID] GPS-derived CAMP_ID: ${derived} (from "${locationName}")`);

  // Persist to disk
  persistState();

  // Update local SQLite records if CAMP_ID changed
  if (oldCampId !== derived) {
    logger.info(`[CAMP-ID] Updating records: ${oldCampId} → ${derived}`);
    updateLocalRecords(oldCampId, derived);
  }

  return derived;
}

/**
 * Update all local SQLite records that used the old CAMP_ID.
 */
function updateLocalRecords(oldCampId, newCampId) {
  try {
    import('./database.js').then(({ pagesDb, disasterDb }) => {
      let total = 0;
      try {
        const r1 = pagesDb.prepare(
          'UPDATE pages_children SET camp_id = ?, synced = 0 WHERE camp_id = ?'
        ).run(newCampId, oldCampId);
        total += r1.changes;
      } catch { /* table may not exist */ }

      try {
        const r2 = pagesDb.prepare(
          'UPDATE pages_alerts SET camp_id = ?, synced = 0 WHERE camp_id = ?'
        ).run(newCampId, oldCampId);
        total += r2.changes;
      } catch { /* table may not exist */ }

      try {
        const r3 = disasterDb.prepare(
          'UPDATE disaster_alerts SET camp_id = ?, synced = 0 WHERE camp_id = ?'
        ).run(newCampId, oldCampId);
        total += r3.changes;
      } catch { /* table may not exist */ }

      if (total > 0) {
        logger.info(`[CAMP-ID] Updated ${total} local records: ${oldCampId} → ${newCampId}`);
      }
    }).catch(() => {
      logger.debug('[CAMP-ID] Database not yet available for record update');
    });
  } catch { /* database not initialized */ }
}

/**
 * Force-set CAMP_ID (testing/manual override).
 */
export function setCampId(campId) {
  const old = _campId;
  _campId = campId;
  _gpsDerived = true;
  persistState();
  if (old !== campId) {
    logger.info(`[CAMP-ID] Manual override: ${old} → ${campId}`);
    updateLocalRecords(old, campId);
  }
}
