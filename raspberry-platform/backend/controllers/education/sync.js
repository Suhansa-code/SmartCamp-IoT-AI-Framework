import { pagesDb } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { runSync } from '../../services/education/sync.js';

export async function triggerSync(req, res, next) {
  try {
    await runSync();
    return res.json({ success: true, message: 'Sync completed' });
  } catch (err) {
    logger.error(`[SYNC] Manual sync failed: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSyncStatus(req, res, next) {
  try {
    const pending = pagesDb.prepare("SELECT COUNT(*) AS c FROM pages_sync_queue WHERE sync_status = 'pending'").get().c;
    const failed = pagesDb.prepare("SELECT COUNT(*) AS c FROM pages_sync_queue WHERE sync_status = 'failed'").get().c;
    const lastSync = pagesDb.prepare('SELECT * FROM pages_sync_log ORDER BY log_id DESC LIMIT 1').get();

    return res.json({
      success: true,
      queue: { pending, failed },
      last_sync: lastSync || null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
