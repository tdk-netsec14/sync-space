/**
 * server/tests/rbac.test.js
 *
 * Integration tests for the RBAC middleware (requireRole).
 *
 * Covers:
 *   - Owner can perform admin actions (update workspace)
 *   - Admin can perform admin actions
 *   - Member cannot perform admin-only actions (403)
 *   - Non-member cannot perform any workspace action (403)
 *
 * The workspace PATCH /api/v1/workspaces/:workspaceId route
 * requires the 'owner' or 'admin' role — ideal for RBAC testing.
 */

const User = require('../models/User');
const Member = require('../models/Member');
const jwt = require('jsonwebtoken');
const { createApp, registerUser, createWorkspace } = require('./helpers');

let app;

beforeAll(() => {
  app = createApp();
});

// ---------------------------------------------------------------------------
// Helper — mint an access token for an arbitrary user document
// ---------------------------------------------------------------------------
function mintToken(user) {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  return jwt.sign({ id: user._id.toString(), name: user.name, email: user.email }, secret, {
    expiresIn: '15m'
  });
}

describe('RBAC middleware — requireRole', () => {
  let ownerAgent, ownerToken, ownerCsrf, workspaceId;

  beforeEach(async () => {
    // Register an owner and create a workspace
    const result = await registerUser(app, { email: `owner-${Date.now()}@rbac.com` });
    ownerAgent = result.agent;
    ownerToken = result.token;
    ownerCsrf = result.csrfToken;

    const wsRes = await createWorkspace(ownerAgent, ownerToken, ownerCsrf, 'RBAC Workspace');
    workspaceId =
      wsRes.body.data?.workspace?.id || wsRes.body.workspace?._id || wsRes.body.workspace?.id;
  });

  test('200 — owner can update workspace (admin action)', async () => {
    const res = await ownerAgent
      .patch(`/api/v1/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-csrf-token', ownerCsrf)
      .send({ name: 'Updated By Owner' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('200 — admin can update workspace (admin action)', async () => {
    // Create a new user and set them as admin in the workspace
    const adminUser = await User.create({
      name: 'Admin User',
      email: `admin-${Date.now()}@rbac.com`,
      password: 'Password1!',
      avatar: '#aabbcc'
    });
    await Member.create({ workspaceId, userId: adminUser._id, role: 'admin' });

    const adminToken = mintToken(adminUser);
    const res = await ownerAgent
      .patch(`/api/v1/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', ownerCsrf)
      .send({ name: 'Updated By Admin' });

    // Admin is allowed — expect 200
    expect(res.status).toBe(200);
  });

  test('403 — member cannot perform admin-only actions', async () => {
    // Create a regular member
    const memberUser = await User.create({
      name: 'Plain Member',
      email: `member-${Date.now()}@rbac.com`,
      password: 'Password1!',
      avatar: '#aabbcc'
    });
    await Member.create({ workspaceId, userId: memberUser._id, role: 'member' });

    const memberToken = mintToken(memberUser);
    const res = await ownerAgent
      .patch(`/api/v1/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-csrf-token', ownerCsrf)
      .send({ name: 'Attempted By Member' });

    expect(res.status).toBe(403);
  });

  test('403 — non-member cannot perform any workspace action', async () => {
    // User who is not a member of the workspace at all
    const stranger = await User.create({
      name: 'Stranger',
      email: `stranger-${Date.now()}@rbac.com`,
      password: 'Password1!',
      avatar: '#aabbcc'
    });

    const strangerToken = mintToken(stranger);
    const res = await ownerAgent
      .patch(`/api/v1/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .set('x-csrf-token', ownerCsrf)
      .send({ name: 'Attempted By Stranger' });

    expect(res.status).toBe(403);
  });
});
