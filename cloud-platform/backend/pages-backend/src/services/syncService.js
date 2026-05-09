import path from 'path';
import fs from 'fs';
import https from 'https';
import logger from '../utils/logger.js';
import C from '../config/constants.js';
import { db} from '../config/database.js';
import { pgQuery, pgIsReachable } from '../config/tursoConfig.js';
import { nowISO } from '../utils/helpers.js';


const TABLE_COLUMNS = {
  pages_children: [
    'child_id','res_id','grade','camp_id','zone_id','language',
    'enrolled_at','total_sessions','baseline_score','consecutive_low',
    'sdq_band','alert_status',
  ],
  pages_sessions: [
    'session_id','child_id','content_session_id','session_date','session_time',
    'condition_label','composite_score','task_score','passive_score',
    'baseline_score_used','gate_decision','second_gate_score','cognitive_score',
    'session_complete','anomaly_flagged','z_score','if_score',
    'alert_triggered','created_at',
  ],
  pages_behavioral_signals: [
    'signal_id','session_id','child_id','accuracy_rate','false_tap_rate',
    'avg_reaction_time','reaction_variance','idle_time_ratio','rapid_click_count',
    'time_to_first_ms','completion_ratio',
  ],
  pages_gate_decisions: [
    'decision_id','session_id','child_id','attempt_number','composite_score',
    'decision','decided_at',
  ],
  pages_alerts: [
    'alert_id','child_id','camp_id','res_id','alert_type','trigger_detail',
    'triggered_at','status','resolved_at','resolved_notes',
  ],
  pages_content_responses: [
    'response_id','session_id','child_id','task_id','selected_answer',
    'is_correct','time_taken_ms','responded_at',
  ],
};

// ── Get the primary key column name for each table ───────────────────────────
const TABLE_PK = {
  pages_children:          'child_id',
  pages_sessions:          'session_id',
  pages_behavioral_signals:'signal_id',
  pages_gate_decisions:    'decision_id',
  pages_alerts:            'alert_id',
  pages_content_responses: 'response_id',
};

/**
 * Push a single record to PostgreSQL.
 * Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
 *
 * @param {string} tableName
 * @param {object} record
 * @returns {Promise<boolean>} true if pushed without error
 */
async function pushRecord(tableName, record) {
  const columns = TABLE_COLUMNS[tableName];
  if (!columns) throw new Error(`Unknown table: ${tableName}`);

  // Build only columns that exist in the record
  const existingCols = columns.filter(c => record[c] !== undefined);
  const values       = existingCols.map(c => record[c]);
  const placeholders = existingCols.map((_, i) => `$${i + 1}`).join(', ');
  const pk           = TABLE_PK[tableName];

  const sql = `
    INSERT INTO ${tableName} (${existingCols.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${pk}) DO NOTHING
  `;

  await pgQuery(sql, values);
  return true;
}

/**
 * Mark a sync_queue item and the source record as synced.
 * Synchronous — uses SQLite.
 *
 * @param {number} queueId
 * @param {string} tableName
 * @param {string} recordId
 */
function markSynced(queueId, tableName, recordId) {
  const pk = TABLE_PK[tableName];
  if (!pk) return;

  // Update source table synced flag
  try {
    db.prepare(`UPDATE ${tableName} SET synced = 1 WHERE ${pk} = ?`).run(recordId);
  } catch {
    // Some tables may not have a synced column (e.g. content_sessions) — ignore
  }

  // Mark queue item
  db.prepare(`
    UPDATE pages_sync_queue
    SET sync_status = 'synced', synced_at = ?
    WHERE queue_id = ?
  `).run(nowISO(), queueId);
}

/**
 * Mark a sync_queue item as failed (after too many retries).
 */
function markFailed(queueId) {
  db.prepare(`
    UPDATE pages_sync_queue
    SET sync_status = 'failed'
    WHERE queue_id = ?
  `).run(queueId);
}

/**
 * Increment retry count for a queue item.
 */
function incrementRetry(queueId) {
  db.prepare(`
    UPDATE pages_sync_queue
    SET retry_count = retry_count + 1
    WHERE queue_id = ?
  `).run(queueId);
}

/**
 * Check S3 for updated model files and download if newer.
 * Only for children with total_sessions >= 8 (IF model threshold).
 *
 * @returns {Promise<number>} count of models pulled
 */
async function pullModelFiles() {
  // Minimal S3 implementation without the AWS SDK
  // Uses the HTTPS REST API directly — avoids a large SDK dependency on RPi
  const campId  = C.CAMP_ID;
  const bucket  = C.AWS_S3_BUCKET;
  const region  = C.AWS_REGION;

  if (!bucket || !C.TURSO_URL) {
    logger.debug('[SYNC] S3 bucket not configured — skipping model pull');
    return 0;
  }

  // Get children eligible for IF model (8+ sessions)
  const eligible = db.prepare(`
    SELECT child_id FROM pages_children
    WHERE camp_id = ? AND total_sessions >= 8
  `).all(campId);

  if (eligible.length === 0) return 0;

  let pulled = 0;

  for (const child of eligible) {
    const childId  = child.child_id;
    const s3Key    = `${campId}/${childId}/model.pkl`;
    const localPath = path.resolve(C.MODELS_DIR, `${childId}.pkl`);
    const s3Url    = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

    try {
      // Check if local model exists and its mtime
      let existingMtime = 0;
      if (fs.existsSync(localPath)) {
        existingMtime = fs.statSync(localPath).mtimeMs;
      }

      // HEAD request to check S3 object LastModified
      const headResult = await s3Head(s3Url);
      if (!headResult) continue;

      const s3Mtime = new Date(headResult).getTime();
      if (s3Mtime <= existingMtime) {
        logger.debug(`[SYNC] Model up to date for ${childId}`);
        continue;
      }

      // Download the model
      await s3Download(s3Url, localPath);
      pulled++;
      logger.info(`[SYNC] Downloaded model for ${childId}: ${localPath}`);
    } catch (err) {
      logger.warn(`[SYNC] Model pull failed for ${childId}: ${err.message}`);
    }
  }

  return pulled;
}

/**
 * HEAD an S3 URL and return the Last-Modified header value.
 * Returns null if the request fails or file does not exist.
 */
function s3Head(url) {
  return new Promise((resolve) => {
    https.request(url, { method: 'HEAD' }, (res) => {
      if (res.statusCode === 200) {
        resolve(res.headers['last-modified'] || null);
      } else {
        resolve(null);
      }
    }).on('error', () => resolve(null)).end();
  });
}

/**
 * Download a file from S3 URL to a local path.
 */
function s3Download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`S3 download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * Write a sync log entry.
 */
function writeSyncLog(recordsPushed, modelsPulled, syncStatus, errorMessage = null) {
  db.prepare(`
    INSERT INTO pages_sync_log (records_pushed, model_files_pulled, sync_status, error_message, synced_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(recordsPushed, modelsPulled, syncStatus, errorMessage, nowISO());
}

/**
 * Main sync function.
 * Called by connectivityService when internet is available.
 *
 * @returns {Promise<{ recordsPushed: number, modelsPulled: number }>}
 */
async function runSync() {
  logger.info('[SYNC] Starting sync run');

  let totalPushed = 0;
  let modelsPulled = 0;
  let hasError = false;

  try {
    //Push records in FK-safe order 
    for (const tableName of C.SYNC_TABLE_ORDER) {
      // Get pending queue items for this table in batches of 50
      let offset = 0;

      while (true) {
        // Check connectivity before each batch
        const still_online = await pgIsReachable();
        if (!still_online) {
          logger.warn('[SYNC] Lost connectivity mid-sync — pausing');
          writeSyncLog(totalPushed, 0, 'partial', 'Lost connectivity mid-sync');
          return { recordsPushed: totalPushed, modelsPulled: 0 };
        }

        const batch = db.prepare(`
          SELECT queue_id, table_name, record_id, retry_count
          FROM   pages_sync_queue
          WHERE  table_name = ? AND sync_status = 'pending'
          ORDER  BY queue_id ASC
          LIMIT  ?
          OFFSET ?
        `).all(tableName, C.SYNC_BATCH_SIZE, offset);

        if (batch.length === 0) break;

        for (const item of batch) {
          if (item.retry_count >= 3) {
            markFailed(item.queue_id);
            logger.warn(`[SYNC] Marking failed (max retries): ${item.table_name} / ${item.record_id}`);
            continue;
          }

          // Read the record from SQLite
          const pk     = TABLE_PK[tableName];
          const record = db.prepare(
            `SELECT * FROM ${tableName} WHERE ${pk} = ?`
          ).get(item.record_id);

          if (!record) {
            // Record was deleted locally — skip
            markFailed(item.queue_id);
            continue;
          }

          try {
            await pushRecord(tableName, record);
            markSynced(item.queue_id, tableName, item.record_id);
            totalPushed++;
          } catch (err) {
            logger.warn(
              `[SYNC] Push failed for ${tableName}/${item.record_id}: ${err.message}`
            );
            incrementRetry(item.queue_id);
            hasError = true;
          }
        }

        if (batch.length < C.SYNC_BATCH_SIZE) break;
        offset += C.SYNC_BATCH_SIZE;
      }
    }

    // Pull model files
    try {
      modelsPulled = await pullModelFiles();
    } catch (err) {
      logger.warn(`[SYNC] Model pull error: ${err.message}`);
    }

    const status = hasError ? 'partial' : 'success';
    writeSyncLog(totalPushed, modelsPulled, status);

    logger.info(
      `[SYNC] Complete: pushed=${totalPushed}, models=${modelsPulled}, status=${status}`
    );

    return { recordsPushed: totalPushed, modelsPulled };

  } catch (err) {
    logger.error(`[SYNC] Fatal sync error: ${err.message}`);
    writeSyncLog(totalPushed, 0, 'error', err.message);
    throw err;
  }
}

/**
 * Get sync status for the API endpoint.
 */
function getSyncStatus() {
  const lastLog = db.prepare(`
    SELECT * FROM pages_sync_log ORDER BY log_id DESC LIMIT 1
  `).get();

  const pendingCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM pages_sync_queue WHERE sync_status = 'pending'
  `).get().cnt;

  return {
    last_sync:       lastLog ? lastLog.synced_at       : null,
    last_status:     lastLog ? lastLog.sync_status     : null,
    records_pushed:  lastLog ? lastLog.records_pushed  : 0,
    pending_records: pendingCount,
  };
}

export { runSync, getSyncStatus };