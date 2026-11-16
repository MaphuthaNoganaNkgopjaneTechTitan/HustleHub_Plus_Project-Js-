const { nodeEnv } = require('../config/config');

// 404 handler - for any route that doesn't match
function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// Centralised error handler - must be registered LAST in server.js (4 args
// is what tells Express this is an error-handling middleware).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Full error is still logged server-side for debugging...
  console.error(`[ERROR] ${new Date().toISOString()} -`, err.message);
  if (nodeEnv === 'development') {
    console.error(err.stack);
  }

  const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;

  // ...but the client only ever gets a safe, generic message. No stack
  // traces, file paths, or internal config values are ever sent in the
  // response body, regardless of environment.
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'An unexpected error occurred. Please try again later.' : err.message,
  });
}

module.exports = { notFound, errorHandler };