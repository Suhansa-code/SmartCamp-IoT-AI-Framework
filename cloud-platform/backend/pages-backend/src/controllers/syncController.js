import logger from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import * as syncService from '../services/syncService.js';
import * as connectivityService from '../services/connectivityService.js';
 
// POST /api/sync/trigger 
 
async function triggerSync(req, res, next) {
  try {
    if (connectivityService.isSyncRunning()) {
      return res.json({
        success: false,
        message: 'Sync already in progress',
      });
    }
 
    const online = connectivityService.isOnline();
 
    // Allow manual trigger to attempt even if watcher says offline
    // (user may have just reconnected)
    logger.info('[SYNC] Manual sync triggered');
 
    const result = await syncService.runSync();
 
    return res.json({
      success:         true,
      records_pushed:  result.recordsPushed,
      models_pulled:   result.modelsPulled,
      message:         'Sync complete',
    });
 
  } catch (err) {
    logger.error(`[SYNC] Manual trigger failed: ${err.message}`);
    return res.status(503).json({
      success: false,
      message: `Sync failed: ${err.message}`,
    });
  }
}
 
//  GET /api/sync/status 
 
function getSyncStatus(req, res, next) {
  try {
    const status = syncService.getSyncStatus();
 
    return res.json({
      success:         true,
      last_sync:       status.last_sync,
      pending_records: status.pending_records,
      is_online:       connectivityService.isOnline(),
      sync_running:    connectivityService.isSyncRunning(),
    });
 
  } catch (err) {
    next(err);
  }
}
 
export { triggerSync, getSyncStatus };