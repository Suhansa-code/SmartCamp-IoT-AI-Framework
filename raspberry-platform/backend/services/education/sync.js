import axios from 'axios';
import { pagesDb, pgQuery } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nowISO } from '../../utils/helpers.js';

let syncInProgress = false;

export async function runSync() {
  if (syncInProgress) {
    logger.info('[SYNC] Previous sync still in progress — skipping');
    return;
  }

  if (!C.TURSO_URL) {
    logger.warn('[SYNC] TURSO_URL not configured — skipping sync');
    return;
  }

  syncInProgress = true;
  logger.info('[SYNC] Starting sync...');

  try {
    let totalPushed = 0;

    for (const table of C.SYNC_TABLE_ORDER) {
      const rows = pagesDb.prepare(
        'SELECT * FROM ?? WHERE synced = 0 ORDER BY rowid ASC LIMIT ?'
      ).all(table, C.SYNC_BATCH_SIZE);

      if (rows.length === 0) continue;

      try {
        await axios.post(`${C.TURSO_URL}/sync/${table}`, { rows }, {
          timeout: 10000,
          headers: { Authorization: `Bearer ${C.TURSO_AUTH_TOKEN}` },
        });

        const ids = rows.map(r => r[Object.keys(r)[0]]);
        pagesDb.prepare(`UPDATE ?? SET synced = 1 WHERE ?? IN (${ids.map(() => '?').join(',')})`)
          .run(table, Object.keys(rows[0])[0], ...ids);

        totalPushed += rows.length;
        logger.info(`[SYNC] Pushed ${rows.length} rows to ${table}`);
      } catch (err) {
        logger.warn(`[SYNC] Failed to push ${table}: ${err.message}`);
      }
    }

    pagesDb.prepare(
      'INSERT INTO pages_sync_log (records_pushed, sync_status, synced_at) VALUES (?, ?, ?)'
    ).run(totalPushed, 'completed', nowISO());

    logger.info(`[SYNC] Completed — pushed ${totalPushed} records`);
  } catch (err) {
    logger.error(`[SYNC] Error: ${err.message}`);
    pagesDb.prepare(
      'INSERT INTO pages_sync_log (records_pushed, sync_status, error_message, synced_at) VALUES (0, ?, ?, ?)'
    ).run('failed', err.message, nowISO());
  } finally {
    syncInProgress = false;
  }
}
