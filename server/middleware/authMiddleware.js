/**
 * server/middleware/authMiddleware.js
 *
 * Verifies the short-lived access token from the Authorization header.
 * Uses JWT_ACCESS_SECRET (falls back to JWT_SECRET for zero-downtime migration).
 *
 * Error codes:
 *   TOKEN_EXPIRED   — client should silently call POST /api/v1/auth/refresh
 *   UNAUTHORIZED    — invalid token; client should redirect to login
 */

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (!token || scheme?.toLowerCase() !== 'bearer') {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' }
      });
    }

    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    const payload = jwt.verify(token, secret);

    req.user = {
      id: payload.id,
      name: payload.name,
      email: payload.email
    };

    return next();
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' }
      });
    }

    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid access token' }
    });
  }
}

module.exports = authMiddleware;
