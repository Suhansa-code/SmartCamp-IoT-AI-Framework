/**
 * Centralized error handler.
 * Returns a consistent JSON error shape and prevents leaking stack traces.
 */
export function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && status >= 500
      ? 'Internal server error'
      : err.message || 'Unexpected error';

  if (status >= 500) {
    console.error('[Error]', err.stack || err);
  }

  res.status(status).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV !== 'production' && err.details ? { details: err.details } : {}),
    },
  });
}
