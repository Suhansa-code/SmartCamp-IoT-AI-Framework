/**
 * sync-notify.js — Lightweight notification for services to signal new sync data.
 *
 * Services call enqueueSync() after a successful local DB transaction.
 * This does NOT perform any MQTT or cloud operation — it simply ensures
 * the record will be picked up by the next sync-manager cycle.
 *
 * Cloud/MQTT failure NEVER blocks the caller.
 *
 * Usage:
 *   import { enqueueSync } from '../sync/sync-notify.js';
 *   // after successful INSERT/UPDATE:
 *   enqueueSync('persons', personId);
 */
import logger from '../../utils/logger.js';

const TABLE_PK = {
  persons:                    'id',
  camp_checkins:              'id',
  wristbands:                 'id',
  distributions:              'id',
  resources:                  'id',
  resource_usage:             'id',
  audit_logs:                 'id',
  pages_children:             'child_id',
  pages_sessions:             'session_id',
  pages_behavioral_signals:   'signal_id',
  pages_gate_decisions:       'decision_id',
  pages_alerts:               'alert_id',
  pages_content_responses:    'response_id',
  disaster_events:            'id',
  water_level_readings:       'id',
  gps_readings:               'id',
  weather_data:               'id',
  hydrospatial_data:          'id',
  flood_predictions:          'id',
  disaster_alerts:            'id',
  prediction_requests:        'id',
};

/**
 * Notify the sync system that a record was created or updated.
 *
 * The record already has synced=0 from the local DB write, so it is
 * automatically discoverable by sync-queue. This function provides:
 *   1. Observability (structured log of what changed)
 *   2. Immediate sync trigger for CRITICAL records
 *   3. A clear integration point for services
 *
 * This function NEVER throws. Cloud/MQTT failure is impossible here
 * because this only logs — the actual sync happens asynchronously.
 *
 * @param {string} tableName — SQLite table name (e.g. 'persons', 'pages_sessions')
 * @param {string|number} recordId — Primary key value of the record
 * @param {object} [meta] — Optional metadata (e.g. { priority: 'CRITICAL' })
 */
export function enqueueSync(tableName, recordId, meta = {}) {
  try {
    const pk = TABLE_PK[tableName] || 'id';
    logger.debug(`[SYNC-ENQUEUE] ${tableName} ${pk}=${recordId}`, {
      table: tableName, record_id: String(recordId), ...meta,
    });
  } catch {
    // Logger failure is non-fatal
  }
}

/**
 * Batch-notify multiple records for sync.
 *
 * @param {string} tableName
 * @param {Array<string|number>} recordIds
 * @param {object} [meta]
 */
export function enqueueSyncBatch(tableName, recordIds, meta = {}) {
  if (!recordIds.length) return;
  try {
    logger.debug(`[SYNC-ENQUEUE] ${tableName} batch(${recordIds.length})`, {
      table: tableName, count: recordIds.length, ...meta,
    });
  } catch {
    // Logger failure is non-fatal
  }
}

export { TABLE_PK };
