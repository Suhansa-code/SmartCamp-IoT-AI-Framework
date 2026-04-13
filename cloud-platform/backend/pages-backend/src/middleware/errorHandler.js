'use strict';

import logger from '../utils/logger.js';
import C from '../config/constants.js';

const { NODE_ENV } = C;

//404 — route not found.
function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
}

/**
 * Central error handler.
 * Must have 4 parameters so Express recognises it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status  = err.statusCode || err.status || 500;
  const message = err.message    || 'Internal server error';

  logger.error(`[ERROR] ${req.method} ${req.originalUrl} → ${status}: ${message}`, {
    stack: NODE_ENV === 'development' ? err.stack : undefined,
  });

  const body = {
    success: false,
    message,
  };

  // Only include stack in development
  if (NODE_ENV === 'development' && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

/**
 * Helper: create an HTTP error with a status code.
 * Usage: throw createError(400, 'Invalid input')
 *
 * @param {number} statusCode
 * @param {string} message
 * @returns {Error}
 */
function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export { notFound, errorHandler, createError };