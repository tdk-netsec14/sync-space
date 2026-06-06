/**
 * server/tests/auth.test.js
 *
 * Integration tests for:
 *   POST /api/v1/auth/register
 *   POST /api/v1/auth/login
 *
 * Covers:
 *   - Valid registration returns 201 + access token
 *   - Duplicate email returns 409
 *   - Weak password returns 400 validation error
 *   - Successful login returns 200 + access token
 *   - Wrong password returns 401
 *   - Account lockout after 5 failed attempts returns 423
 */

const request = require('supertest');
const { createApp, getCsrf, registerUser, loginUser } = require('./helpers');

let app;

beforeAll(() => {
  app = createApp();
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/register', () => {
  test('201 — valid registration returns token and user', async () => {
    const { res } = await registerUser(app);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toMatchObject({ email: expect.any(String), name: 'Test User' });
  });

  test('409 — duplicate email is rejected', async () => {
    const email = `dup-${Date.now()}@example.com`;
    // First registration
    await registerUser(app, { email });
    // Second attempt with same email
    const { res } = await registerUser(app, { email });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('400 — weak password (no uppercase) is rejected', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);

    const res = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Weak User', email: 'weak@example.com', password: 'password1!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — weak password (no number) is rejected', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);

    const res = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Weak User', email: 'weak2@example.com', password: 'Password!!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — weak password (too short) is rejected', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);

    const res = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Weak User', email: 'weak3@example.com', password: 'P1!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — missing name is rejected', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrf(agent);

    const res = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'noname@example.com', password: 'Password1!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/login', () => {
  test('200 — correct credentials return token and user', async () => {
    const email = `login-${Date.now()}@example.com`;
    await registerUser(app, { email });

    const { res } = await loginUser(app, email, 'Password1!');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  test('401 — wrong password returns UNAUTHORIZED', async () => {
    const email = `wrongpw-${Date.now()}@example.com`;
    await registerUser(app, { email });

    const { res } = await loginUser(app, email, 'WrongPass1!');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('401 — non-existent email returns UNAUTHORIZED', async () => {
    const { res } = await loginUser(app, 'nobody@nowhere.com', 'Password1!');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('423 — account locks after 5 failed attempts', async () => {
    const email = `lockout-${Date.now()}@example.com`;
    await registerUser(app, { email });

    // Make 5 wrong-password attempts
    for (let i = 0; i < 5; i++) {
      await loginUser(app, email, 'WrongPassword1!');
    }

    // 6th attempt should see ACCOUNT_LOCKED
    const { res } = await loginUser(app, email, 'WrongPassword1!');

    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});
