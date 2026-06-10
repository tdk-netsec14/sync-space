/**
 * server/middleware/security.js
 *
 * Centralised security middleware stack applied to the Express app.
 * Import `applySecurityMiddleware(app)` in index.js.
 */

const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const { doubleCsrf } = require('csrf-csrf');
const cookieParser = require('cookie-parser');

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/**
 * Global limiter — 100 requests per 15 minutes per IP.
 * Applied to every route.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

/**
 * Strict auth limiter — 10 requests per 15 minutes per IP.
 * Applied only to /api/auth/*.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: process.env.NODE_ENV === 'test' ? 1000 : 10, // skip limit in tests so sequential tests don't fail
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many auth attempts from this IP, please try again after 15 minutes'
    }
  },
  skipSuccessfulRequests: false
});

// ---------------------------------------------------------------------------
// CSRF is disabled in test mode to simplify integration testing.
// Full CSRF protection remains active in development and production.
const IS_TEST = process.env.NODE_ENV === 'test';

const { generateCsrfToken: _generateCsrfToken, doubleCsrfProtection: _doubleCsrfProtection } =
  doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || process.env.JWT_ACCESS_SECRET || 'csrf-dev-secret',
    getSessionIdentifier: (req) => req.ip || 'unknown',
    cookieName: 'syncspace_csrf',
    cookieOptions: {
      httpOnly: true,
      // In production the frontend and backend are on different domains
      // (vercel.app vs onrender.com) so sameSite must be 'none' (requires secure:true).
      // In development both run on localhost so 'strict' is fine.
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    },
    size: 64,
    getTokenFromRequest: (req) => req.headers['x-csrf-token'] || req.body?._csrf || req.query?._csrf
  });

// In test mode: no-op stubs so tests don't need to deal with CSRF tokens
const generateCsrfToken = IS_TEST ? (_req, _res) => 'test-csrf-token' : _generateCsrfToken;

const doubleCsrfProtection = IS_TEST ? (_req, _res, next) => next() : _doubleCsrfProtection;

// ---------------------------------------------------------------------------
// Helmet CSP
// ---------------------------------------------------------------------------

function buildHelmet() {
  const clientOrigin = process.env.CLIENT_URL || '';
  // Extract hostname for CSP directives (strip protocol)
  let clientHost = '';
  try {
    clientHost = new URL(clientOrigin).hostname;
  } catch {
    clientHost = '';
  }

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: [
          "'self'",
          ...(clientHost ? [`https://${clientHost}`, `wss://${clientHost}`] : [])
        ],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Applies all security middleware to the given Express app instance.
 * Call this BEFORE registering any routes.
 *
 * @param {import('express').Application} app
 */
function applySecurityMiddleware(app) {
  // 1. Parse cookies (required by csrf-csrf)
  app.use(cookieParser());

  // 2. HTTP security headers
  app.use(buildHelmet());

  // 3. NoSQL injection prevention — sanitise $-operators out of body/params.
  //    express-mongo-sanitize cannot sanitize req.query on Express 5 (it is a
  //    read-only getter). We sanitise req.body and req.params which is where
  //    injection payloads arrive in JSON APIs.
  app.use((req, res, next) => {
    mongoSanitize.sanitize(req.body, { replaceWith: '_', allowDots: false });
    mongoSanitize.sanitize(req.params, { replaceWith: '_', allowDots: false });
    next();
  });

  // 4. HTTP Parameter Pollution protection
  app.use(hpp());

  // 5. Global rate limiter
  app.use(globalLimiter);
}

module.exports = {
  applySecurityMiddleware,
  authLimiter,
  generateCsrfToken,
  doubleCsrfProtection
};
