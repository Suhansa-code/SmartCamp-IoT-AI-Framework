'use strict';

import 'dotenv/config';
import './config/database.js';
import app from './app.js';
import C from './config/constants.js';
import logger from './utils/logger.js';
import { startConnectivityWatcher } from './services/connectivityService.js';
import { checkFlaskHealth } from './services/scoringService.js';

const PORT = C.PORT;

// ── Retry logic for TIME_WAIT port conflicts ──────────────────────────────────
let startAttempt = 0;
const MAX_RETRIES = 5;

function startServer() {
  logger.info(`[SERVER] Starting server on port ${PORT}... (attempt ${startAttempt + 1}/${MAX_RETRIES})`);
  
  const server = app.listen(PORT, '0.0.0.0', async() => {
    logger.info('════════════════════════════════════════════');
    logger.info('  PAGES Backend — Eli\'s World');
    logger.info(`  Device:  ${C.DEVICE_ID}`);
    logger.info(`  Camp:    ${C.CAMP_ID}`);
    logger.info(`  Port:    ${PORT}`);
    logger.info(`  Env:     ${C.NODE_ENV}`);
    logger.info(`  Gate:    composite >= ${C.GATE_THRESHOLD} → PASS`);
    logger.info('════════════════════════════════════════════');

     // Check Flask health at startup
    const flaskHealthy = await checkFlaskHealth();
    if (flaskHealthy) {
      logger.info(`[FLASK] Connected to ${C.FLASK_URL}`);
    } else {
      logger.warn(`[FLASK] Warning: ${C.FLASK_URL} is unreachable — fallback scoring will be used`);
    }

    // Start the connectivity watcher after server is listening
    startConnectivityWatcher();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && startAttempt < MAX_RETRIES) {
      startAttempt++;
      const delay = Math.pow(2, startAttempt) * 1000; // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      logger.warn(`[SERVER] Port ${PORT} in use (TIME_WAIT). Retrying in ${delay}ms...`);
      setTimeout(startServer, delay);
    } else {
      logger.error(`[SERVER] Failed to start server: ${err.message}`);
      throw err;
    }
  });

  return server;
}
const server = startServer();

//  Graceful shutdown
function shutdown(signal) {
  logger.info(`[SERVER] Received ${signal} — shutting down gracefully`);
  server.close(() => {
    logger.info('[SERVER] HTTP server closed');
    // better-sqlite3 closes automatically on process exit
    process.exit(0);
  });

  // Force exit if server hasn't closed within 10s
  setTimeout(() => {
    logger.error('[SERVER] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error(`[SERVER] Uncaught exception: ${err.message}`, { stack: err.stack });
  // Do not exit on uncaught exception in production — RPi must keep running
  // In development, rethrow to get a proper crash report
  if (C.NODE_ENV === 'development') throw err;
});

process.on('unhandledRejection', (reason) => {
  logger.error(`[SERVER] Unhandled rejection: ${reason}`);
});

export default server;