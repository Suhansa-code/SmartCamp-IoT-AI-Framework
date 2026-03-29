'use strict';

const cron   = require('node-cron');
const logger = require('../utils/logger');
const C      = require('../config/constants');
const { pgIsReachable } = require('../config/database');

// ── State ─────────────────────────────────────────────────────────────────────
let _isOnline      = false;
let _syncRunning   = false;
let _lastSyncTime  = null;
let _lastCheckTime = null;

// Lazy-load syncService to break circular dependency
// (syncService uses db, connectivityService is used by syncService)
function getSyncService() {
  return require('./syncService');
}

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
    const syncService = getSyncService();
    const result = await syncService.runSync();
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

module.exports = {
  startConnectivityWatcher,
  checkAndSync,
  isOnline,
  isSyncRunning,
  getLastSyncTime,
};