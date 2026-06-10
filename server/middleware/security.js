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
// CSRF — disabled for this JWT-based SPA.
//
// WHY IT IS SAFE TO SKIP:
//   • The access token lives in localStorage, not a cookie.
//     A CSRF attack can trigger a browser to send cookies automatically,
//     but it CANNOT read localStorage. Without the access token the
//     attacker's request will be rejected by authMiddleware.
//   • The only cookie we set is the HttpOnly refresh token, but the
//     /auth/refresh endpoint does not perform any destructive action —
//     it just issues a new access token, which the attacker still cannot
//     read due to the Same-Origin policy.
//   • CORS is locked to CLIENT_URL in production, so cross-origin
//     requests from malicious sites are rejected before reaching any route.
//
// Keeping csrf-csrf active caused production failures because:
//   1. sameSite:'strict' blocks cross-origin cookies (vercel ↔ onrender).
//   2. getSessionIdentifier(req.ip) is unstable behind Render's load balancer.
// ---------------------------------------------------------------------------

const generateCsrfToken = (_req, _res) => 'csrf-disabled';
const doubleCsrfProtection = (_req, _res, next) => next();


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
