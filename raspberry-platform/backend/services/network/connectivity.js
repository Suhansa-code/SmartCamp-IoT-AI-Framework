import logger from '../../utils/logger.js';
import { pgIsReachable } from '../../config/database.js';
import * as saamp from './saamp-mqtt.js';

let watcherInterval = null;
let lastReachability = { postgres: null, broker: null, checked_at: null };

export function getReachability() {
  return lastReachability;
}

/**
 * Second opinion on connectivity, independent of the prediction model.
 *
 * This deliberately does NOT drive the network state: the cloud database being
 * unreachable is not the same failure as a degraded uplink, and conflating them
 * would buffer traffic the broker could have taken. What it does give us is the
 * discriminator — PostgreSQL down while the broker is up means the problem is
 * upstream of us, not on the camp link.
 */
async function sample() {
  const postgres = await pgIsReachable();
  const broker = saamp.isConnectedToBroker();
  lastReachability = { postgres, broker, checked_at: new Date().toISOString() };

  if (!postgres && !broker) {
    logger.warn('[CONNECTIVITY] Both PostgreSQL and broker unreachable — camp uplink is likely down');
  } else if (!postgres && broker) {
    logger.warn('[CONNECTIVITY] PostgreSQL unreachable but broker is up — cloud-side problem, link is fine');
  } else if (postgres && !broker) {
    logger.warn('[CONNECTIVITY] Broker unreachable but PostgreSQL is up — broker/EMQX problem, link is fine');
  } else {
    logger.debug('[CONNECTIVITY] PostgreSQL and broker both reachable');
  }
}

export function startConnectivityWatcher() {
  const intervalMs = Number(process.env.CONNECTIVITY_INTERVAL_MS || 30000);
  logger.info(`[CONNECTIVITY] Starting watcher (every ${intervalMs}ms)`);

  watcherInterval = setInterval(
    () => sample().catch((e) => logger.error(`[CONNECTIVITY] Check failed: ${e.message}`)),
    intervalMs
  );

}

export function stopConnectivityWatcher() {
  if (watcherInterval) clearInterval(watcherInterval);
  watcherInterval = null;
}
