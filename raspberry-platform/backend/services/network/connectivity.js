import logger from '../../utils/logger.js';
import { pgPool } from '../../config/database.js';

let watcherInterval = null;

export function startConnectivityWatcher() {
  if (!pgPool) {
    logger.info('[CONNECTIVITY] PostgreSQL not configured — watcher disabled');
    return;
  }

  const intervalMs = 30000;
  logger.info(`[CONNECTIVITY] Starting watcher (every ${intervalMs}ms)`);

  watcherInterval = setInterval(async () => {
    try {
      await pgPool.query('SELECT 1');
      logger.info('[CONNECTIVITY] PostgreSQL: online');
    } catch {
      logger.info('[CONNECTIVITY] PostgreSQL: offline');
    }
  }, intervalMs);
}

export function stopConnectivityWatcher() {
  if (watcherInterval) clearInterval(watcherInterval);
}
