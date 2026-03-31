/**
 * Global Express error handler.
 * Returns consistent JSON for all unhandled errors.
 * Strips stack traces in production.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status  = err.statusCode || err.status || 500;
  const isProd  = process.env.NODE_ENV === 'production';

  // Log every 5xx with stack trace
  if (status >= 500) {
    console.error(`[Error] ${req.method} ${req.path} — ${err.message}`);
    if (!isProd) console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    error:   err.message || 'Internal server error',
    ...(isProd ? {} : { stack: err.stack }),
    ...(err.code ? { code: err.code } : {}),
  });
}

module.exports = errorHandler;
