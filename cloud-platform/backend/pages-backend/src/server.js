'use strict';

import 'dotenv/config';

// Initialise DB first — ensures SQLite schema is applied before any request
import './config/database.js';

import app from './app.js';
import C from './config/constants.js';
import logger from './utils/logger.js';
import { startConnectivityWatcher } from './services/connectivityService.js';

const PORT = C.PORT;

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info('════════════════════════════════════════════');
  logger.info('  PAGES Backend — Eli\'s World');
  logger.info(`  Device:  ${C.DEVICE_ID}`);
  logger.info(`  Camp:    ${C.CAMP_ID}`);
  logger.info(`  Port:    ${PORT}`);
  logger.info(`  Env:     ${C.NODE_ENV}`);
  logger.info(`  Gate:    composite >= ${C.GATE_THRESHOLD} → PASS`);
  logger.info('════════════════════════════════════════════');

  // Start the connectivity watcher after server is listening
  startConnectivityWatcher();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

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