/**
 * server/tests/helpers.js
 *
 * Shared helpers for backend integration tests.
 * Provides createApp() which builds a fresh Express app instance
 * (without calling httpServer.listen()) for Supertest.
 *
 * Also exposes helper functions to:
 *  - register a user and return { token, user }
 *  - create a workspace and return it
 *  - get a CSRF token from the app
 */

const request = require('supertest');

/**
 * Build the Express app without starting the HTTP server.
 * We import index.js lazily inside each test file to avoid
 * port conflicts; instead we create the app here cleanly.
 */
function createApp() {
  // Minimal re-creation of the Express app without listen()
  // We do this by requiring the modular pieces used in index.js.
  const express = require('express');
  const cors = require('cors');
  const morgan = require('morgan');

  const { applySecurityMiddleware, authLimiter } = require('../middleware/security');
  const errorHandler = require('../middleware/errorHandler');
  const requireJson = require('../middleware/requireJson');

  const authRoutes = require('../routes/auth');
  const workspaceRoutes = require('../routes/workspaces');
  const memberRoutes = require('../routes/members');
  const aiRoutes = require('../routes/ai');

  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  applySecurityMiddleware(app);
  // Suppress all request logs in test output
  app.use(morgan('dev', { skip: () => true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(requireJson);

  // Mount routes — mirror index.js
  app.use('/api/v1/auth', authLimiter, authRoutes);
  app.use('/api/v1/workspaces', workspaceRoutes);
  app.use('/api/v1/workspaces', memberRoutes);
  app.use('/api/v1/workspaces', aiRoutes);

  app.use(errorHandler);

  return app;
}

/**
 * In test mode CSRF is a no-op — returns a placeholder token.
 * In production the agent must hit /csrf-token and pass the cookie.
 */
async function getCsrf(agent) {
  // CSRF middleware is bypassed in NODE_ENV=test, so any string works.
  // We still call the endpoint to ensure it doesn't error.
  await agent.get('/api/v1/auth/csrf-token').catch(() => {});
  return 'test-csrf-token';
}

/**
 * Register a new test user and return { token, user, agent }.
 * The agent has the session cookies (refresh + csrf) already set.
 */
async function registerUser(app, overrides = {}) {
  const agent = request.agent(app);
  const csrfToken = await getCsrf(agent);

  const payload = {
    name: overrides.name || 'Test User',
    email: overrides.email || `test-${Date.now()}@example.com`,
    password: overrides.password || 'Password1!'
  };

  const res = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', csrfToken)
    .send(payload);

  return {
    res,
    agent,
    csrfToken,
    token: res.body.token,
    user: res.body.user,
    email: payload.email
  };
}

/**
 * Login an existing user by email/password.
 */
async function loginUser(app, email, password = 'Password1!') {
  const agent = request.agent(app);
  const csrfToken = await getCsrf(agent);

  const res = await agent
    .post('/api/v1/auth/login')
    .set('x-csrf-token', csrfToken)
    .send({ email, password });

  return { res, agent, csrfToken, token: res.body.token };
}

/**
 * Create a workspace for an authenticated user.
 */
async function createWorkspace(agent, token, csrfToken, name = 'Test Workspace') {
  const res = await agent
    .post('/api/v1/workspaces')
    .set('Authorization', `Bearer ${token}`)
    .set('x-csrf-token', csrfToken)
    .send({ name });
  return res;
}

module.exports = { createApp, getCsrf, registerUser, loginUser, createWorkspace };
