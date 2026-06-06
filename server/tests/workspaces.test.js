/**
 * server/tests/workspaces.test.js
 *
 * Integration tests for:
 *   POST /api/v1/workspaces
 *
 * Covers:
 *   - Authenticated user can create a workspace
 *   - Unauthenticated request is rejected with 401
 *   - Missing workspace name returns 400 validation error
 */

const request = require('supertest');
const { createApp, registerUser, createWorkspace } = require('./helpers');

let app;

beforeAll(() => {
  app = createApp();
});

describe('POST /api/v1/workspaces', () => {
  test('201 — authenticated user can create a workspace', async () => {
    const { agent, token, csrfToken } = await registerUser(app);
    const res = await createWorkspace(agent, token, csrfToken, 'My Test Workspace');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.workspace?.name || res.body.workspace?.name).toBe('My Test Workspace');
  });

  test('401 — unauthenticated request is rejected', async () => {
    const agent = request.agent(app);

    const res = await agent
      .post('/api/v1/workspaces')
      .set('Content-Type', 'application/json')
      .send({ name: 'Ghost Workspace' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('400 — missing workspace name returns validation error', async () => {
    const { agent, token, csrfToken } = await registerUser(app);

    const res = await agent
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .set('x-csrf-token', csrfToken)
      .send({ description: 'No name given' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('401 — expired/invalid token is rejected', async () => {
    const agent = request.agent(app);

    const res = await agent
      .post('/api/v1/workspaces')
      .set('Authorization', 'Bearer not.a.real.token')
      .set('Content-Type', 'application/json')
      .send({ name: 'Bad Token Workspace' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
