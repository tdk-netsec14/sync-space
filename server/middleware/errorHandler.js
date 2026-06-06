/**
 * server/middleware/errorHandler.js
 *
 * Centralized Express error-handling middleware.
 *
 * Catches every error forwarded via next(error) — including:
 *   • AppError instances (our own typed errors)
 *   • Mongoose validation / duplicate-key errors
 *   • Zod validation errors (if not caught by validate middleware)
 *   • csrf-csrf token errors
 *   • express-rate-limit rejections
 *   • Generic unhandled throws
 *
 * Response shape — always:
 *   { success: false, error: { code: string, message: string } }
 *
 * Stack traces are NEVER sent to the client in production.
 */

const { ZodError } = require('zod');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Extracts a safe IP address from the request (handles proxies).
 */
function getIP(req) {
  return (
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Maps a raw error to a normalised { statusCode, code, message } triple.
 */
function normalise(error) {
  // Our own typed application errors
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    };
  }

  // Zod schema errors (fallthrough — normally caught by validate middleware)
  if (error instanceof ZodError) {
    const fields = {};
    error.errors.forEach((issue) => {
      const key = issue.path.join('.') || 'body';
      if (!fields[key]) fields[key] = issue.message;
    });
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields
    };
  }

  // Mongoose duplicate-key error (e.g. unique email)
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'field';
    return {
      statusCode: 409,
      code: 'CONFLICT',
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
    };
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const fields = {};
    Object.values(error.errors).forEach((e) => {
      fields[e.path] = e.message;
    });
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields
    };
  }

  // Mongoose CastError (invalid ObjectId etc.)
  if (error.name === 'CastError') {
    return {
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: `Invalid value for field '${error.path}'`
    };
  }

  // JWT errors (shouldn't usually reach here — authMiddleware handles them)
  if (error.name === 'JsonWebTokenError') {
    return { statusCode: 401, code: 'UNAUTHORIZED', message: 'Invalid token' };
  }
  if (error.name === 'TokenExpiredError') {
    return { statusCode: 401, code: 'TOKEN_EXPIRED', message: 'Token expired' };
  }

  // csrf-csrf invalid CSRF token
  if (error.code === 'EBADCSRFTOKEN' || error.message === 'invalid csrf token') {
    return { statusCode: 403, code: 'CSRF_INVALID', message: 'Invalid or missing CSRF token' };
  }

  // express-rate-limit (status 429 already set by the middleware)
  if (error.status === 429) {
    return {
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: error.message || 'Too many requests'
    };
  }

  // CORS rejection
  if (error.message && error.message.startsWith('CORS:')) {
    return { statusCode: 403, code: 'CORS_BLOCKED', message: 'Origin not allowed' };
  }

  // Unknown / unexpected errors
  return {
    statusCode: error.statusCode || error.status || 500,
    code: 'INTERNAL_ERROR',
    message: isProduction ? 'Something went wrong' : error.message || 'Internal server error'
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  const { statusCode, code, message, fields } = normalise(error);

  // Log the error — always include the original error object for internal records
  const logMeta = {
    code,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: getIP(req),
    userId: req.user?.id || null
  };

  if (statusCode >= 500) {
    logger.error(message, { ...logMeta, err: error.stack || error.message });
  } else if (statusCode >= 400) {
    logger.warn(message, logMeta);
  }

  const body = {
    success: false,
    error: { code, message }
  };

  // Include field-level validation errors if present
  if (fields) {
    body.error.fields = fields;
  }

  return res.status(statusCode).json(body);
}

module.exports = errorHandler;
