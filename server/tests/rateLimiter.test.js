/**
 * server/tests/rateLimiter.test.js
 *
 * Integration tests for the AI route rate limiter.
 *
 * The AI router applies two rate limits:
 *   - 5 requests per minute per user
 *   - 20 requests per hour per user
 *
 * This test verifies that the 6th request within a 60-second window
 * receives a 429 Too Many Requests response.
 *
 * NOTE: rate-limiter stores are in-memory by default and reset between
 * process restarts. Each test suite gets a fresh app instance so the
 * counter starts from 0.
 */

const { createApp, registerUser, createWorkspace } = require('./helpers');

// ---------------------------------------------------------------------------
// Helper — build a minimal valid AI request body.
// We target the standup endpoint because it only requires workspaceId
// (no boardId/dateRange params to set up).
// Even though AI_ENABLED=true, actual AI calls will fail in test env
// (no real API keys) — but the rate-limiter fires BEFORE the AI call.
// ---------------------------------------------------------------------------

describe('AI rate limiter — 5 req/min per user', () => {
  test('6th request within 60 seconds returns 429', async () => {
    const app = createApp();
    const { agent, token, csrfToken } = await registerUser(app);

    // Create a workspace so the ensureWorkspaceMember check passes
    const wsRes = await createWorkspace(agent, token, csrfToken, 'RL Workspace');
    const workspaceId =
      wsRes.body.data?.workspace?.id || wsRes.body.workspace?.id || wsRes.body.workspace?._id;

    const statuses = [];

    // Fire 6 requests as fast as possible
    for (let i = 0; i < 6; i++) {
      const res = await agent
        .post(`/api/v1/workspaces/${workspaceId}/ai/standup`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-csrf-token', csrfToken)
        .send({});

      statuses.push(res.status);
    }

    // The first 5 should NOT be 429 (they will be 500/AI error since no keys
    // in test, but NOT rate-limited). The 6th must be 429.
    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
