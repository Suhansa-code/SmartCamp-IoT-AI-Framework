'use strict';

require('dotenv').config();

// Initialise DB first — ensures SQLite schema is applied before any request
require('./config/database');

const app    = require('./app');
const C      = require('./config/constants');
const logger = require('./utils/logger');
const connectivityService = require('./services/connectivityService');

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
  connectivityService.startConnectivityWatcher();
});

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

module.exports = server;