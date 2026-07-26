import logger from '../utils/logger.js';
import { pgIsReachable } from '../config/database.js';

let watcherInterval = null;

export function startConnectivityWatcher() {
  const intervalMs = 30000;
  logger.info(`[CONNECTIVITY] Starting watcher (every ${intervalMs}ms)`);

  watcherInterval = setInterval(async () => {
    const pgOnline = await pgIsReachable();
    logger.info(`[CONNECTIVITY] PostgreSQL: ${pgOnline ? 'online' : 'offline'}`);
  }, intervalMs);
}

export function stopConnectivityWatcher() {
  if (watcherInterval) clearInterval(watcherInterval);
}
