import cron from 'node-cron';
import logger from '../utils/logger.js';
import C from '../config/constants.js';
import { pgIsReachable } from '../config/database.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _isOnline      = false;
let _syncRunning   = false;
let _lastSyncTime  = null;
let _lastCheckTime = null;

/**
 * Check connectivity and trigger sync if appropriate.
 */
async function checkAndSync() {
  _lastCheckTime = new Date().toISOString();

  const online = await pgIsReachable();
  _isOnline = online;

  if (!online) {
    logger.info('[CONNECTIVITY] Offline — sync skipped');
    return;
  }

  logger.info('[CONNECTIVITY] Online detected');

  if (_syncRunning) {
    logger.info('[CONNECTIVITY] Sync already running — skipping');
    return;
  }

  _syncRunning = true;
  try {
    // Lazy-load syncService to break circular dependency
    // (syncService uses db, connectivityService is used by syncService)
    const { runSync } = await import('./syncService.js');
    const result = await runSync();
    _lastSyncTime = new Date().toISOString();
    logger.info(
      `[CONNECTIVITY] Sync complete: ${result.recordsPushed} records pushed, ` +
      `${result.modelsPulled} models pulled`
    );
  } catch (err) {
    logger.error(`[CONNECTIVITY] Sync failed: ${err.message}`);
  } finally {
    _syncRunning = false;
  }
}

/**
 * Start the connectivity watcher cron job.
 * Called once in server.js after Express server is listening.
 */
function startConnectivityWatcher() {
  const minutes = C.SYNC_INTERVAL_MINUTES;

  // Build cron expression: every N minutes
  // node-cron supports */N minute syntax
  const cronExpr = `*/${minutes} * * * *`;

  logger.info(`[CONNECTIVITY] Starting watcher — interval: every ${minutes} min (${cronExpr})`);

  cron.schedule(cronExpr, () => {
    checkAndSync().catch(err =>
      logger.error(`[CONNECTIVITY] Unhandled error in watcher: ${err.message}`)
    );
  });

  // Run once immediately on startup (after a short delay to let DB settle)
  setTimeout(() => {
    checkAndSync().catch(err =>
      logger.error(`[CONNECTIVITY] Initial check failed: ${err.message}`)
    );
  }, 5000);
}

function isOnline()      { return _isOnline; }
function isSyncRunning() { return _syncRunning; }
function getLastSyncTime() { return _lastSyncTime; }

export {
  startConnectivityWatcher,
  checkAndSync,
  isOnline,
  isSyncRunning,
  getLastSyncTime,
};