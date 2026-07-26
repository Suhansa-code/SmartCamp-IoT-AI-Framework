import logger from '../utils/logger.js';

const { NODE_ENV } = process.env;

export function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
}

export function errorHandler(err, req, res, next) {
  const status  = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  logger.error(`[ERROR] ${req.method} ${req.originalUrl} → ${status}: ${message}`, {
    stack: NODE_ENV === 'development' ? err.stack : undefined,
  });

  const body = { success: false, message };
  if (NODE_ENV === 'development' && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

export function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}
