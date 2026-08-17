/**
 * Lightweight request logger for API traffic.
 */
export function requestLogger(req, _res, next) {
  const start = Date.now();
  _res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${_res.statusCode} (${elapsed}ms)`);
  });
  next();
}
