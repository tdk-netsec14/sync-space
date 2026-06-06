/**
 * server/utils/AppError.js
 *
 * Typed application error class.
 * Throw these from route handlers / services to produce clean, consistent
 * HTTP responses without leaking internal details.
 *
 * Usage:
 *   const AppError = require('../utils/AppError');
 *
 *   // In a route handler:
 *   throw new AppError('Workspace not found', 404, 'NOT_FOUND');
 *
 *   // In the error handler it becomes:
 *   { success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }
 */

class AppError extends Error {
  /**
   * @param {string}  message    - Human-readable error message (safe to expose to client)
   * @param {number}  statusCode - HTTP status code (default 500)
   * @param {string}  code       - Machine-readable error code (default 'INTERNAL_ERROR')
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    // Capture V8 stack trace, excluding the constructor frame
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Common factory helpers ───────────────────────────────────────────────────

AppError.badRequest = (message = 'Bad request') => new AppError(message, 400, 'BAD_REQUEST');

AppError.unauthorized = (message = 'Unauthorized') => new AppError(message, 401, 'UNAUTHORIZED');

AppError.forbidden = (message = 'Forbidden') => new AppError(message, 403, 'FORBIDDEN');

AppError.notFound = (message = 'Not found') => new AppError(message, 404, 'NOT_FOUND');

AppError.conflict = (message = 'Conflict') => new AppError(message, 409, 'CONFLICT');

AppError.locked = (message = 'Account is locked') => new AppError(message, 423, 'ACCOUNT_LOCKED');

AppError.tooMany = (message = 'Too many requests') => new AppError(message, 429, 'RATE_LIMITED');

AppError.internal = (message = 'Something went wrong') =>
  new AppError(message, 500, 'INTERNAL_ERROR');

module.exports = AppError;
