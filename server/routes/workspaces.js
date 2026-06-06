const express = require('express');
const { z } = require('zod');

const Workspace = require('../models/Workspace');
const Member = require('../models/Member');
const InviteToken = require('../models/InviteToken');
const Task = require('../models/Task');
const Column = require('../models/Column');
const ActivityLog = require('../models/ActivityLog');
const Board = require('../models/Board');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/rbacMiddleware');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const asyncHandler = require('../utils/asyncHandler');
const { sendWithETag } = require('../middleware/etag');
const { logActivity } = require('../services/activityService');
const User = require('../models/User');

const router = express.Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color (must be a 6-digit hex like #6366f1)')
  .optional();

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(80, 'Name is too long'),
  description: z.string().trim().max(500, 'Description is too long').optional().default(''),
  logo: z.string().trim().max(2, 'Logo must be 1-2 characters').optional().default('S'),
  color: HEX_COLOR.default('#6366f1')
});

const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Workspace name is required')
    .max(80, 'Name is too long')
    .optional(),
  description: z.string().trim().max(500, 'Description is too long').optional(),
  logo: z.string().trim().max(2, 'Logo must be 1-2 characters').optional(),
  color: HEX_COLOR
});

const inviteSchema = z.object({
  role: z
    .enum(['admin', 'member'], {
      errorMap: () => ({ message: 'Role must be "admin" or "member"' })
    })
    .default('member')
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getMembership(workspaceId, userId) {
  return Member.findOne({ workspaceId, userId }).populate('workspaceId').lean();
}

async function createUniqueSlug(name, workspaceIdToIgnore = null) {
  const baseSlug =
    String(name || 'workspace')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workspace';

  let slug = baseSlug;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const conflict = await Workspace.findOne({
      slug,
      ...(workspaceIdToIgnore ? { _id: { $ne: workspaceIdToIgnore } } : {})
    });
    if (!conflict) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isDoneColumnName(name = '') {
  return String(name).trim().toLowerCase() === 'done';
}

// ---------------------------------------------------------------------------
// GET /api/workspaces/join/:token — public invite info
// ---------------------------------------------------------------------------

router.get(
  '/join/:token',
  asyncHandler(async (req, res) => {
    const invite = await InviteToken.findByRawToken(req.params.token)
      .populate('workspaceId')
      .lean();

    if (!invite) return res.json({ valid: false, reason: 'invalid' });
    if (invite.usedAt) return res.json({ valid: false, reason: 'used' });
    if (invite.expiresAt.getTime() <= Date.now())
      return res.json({ valid: false, reason: 'expired' });

    return res.json({
      valid: true,
      role: invite.role,
      workspace: {
        id: invite.workspaceId._id,
        name: invite.workspaceId.name,
        logo: invite.workspaceId.logo,
        color: invite.workspaceId.color
      }
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/workspaces — create workspace
// ---------------------------------------------------------------------------

router.post(
  '/',
  authMiddleware,
  validate(createWorkspaceSchema),
  asyncHandler(async (req, res) => {
    const { name, description, logo, color } = req.body;
    const slug = await createUniqueSlug(name);

    const workspace = await Workspace.create({
      name,
      slug,
      description,
      logo,
      color,
      ownerId: req.user.id
    });

    const member = await Member.create({
      workspaceId: workspace._id,
      userId: req.user.id,
      role: 'owner'
    });

    return res.status(201).json({ success: true, workspace, member });
  })
);

// ---------------------------------------------------------------------------
// GET /api/workspaces — list my workspaces
// ---------------------------------------------------------------------------

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const memberships = await Member.find({ userId: req.user.id }).populate('workspaceId').lean();

    return res.json({
      success: true,
      workspaces: memberships
        .filter((m) => m.workspaceId)
        .map((m) => ({
          id: m.workspaceId._id,
          name: m.workspaceId.name,
          slug: m.workspaceId.slug,
          description: m.workspaceId.description,
          logo: m.workspaceId.logo,
          color: m.workspaceId.color,
          ownerId: m.workspaceId.ownerId,
          createdAt: m.workspaceId.createdAt,
          role: m.role
        }))
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/join/:token — authenticated join via invite link
// ---------------------------------------------------------------------------

router.post(
  '/join/:token',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const invite = await InviteToken.findByRawToken(req.params.token)
      .populate('workspaceId')
      .lean();

    if (!invite)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Invalid invite token' } });
    if (invite.usedAt)
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invite token already used' }
      });
    if (invite.expiresAt.getTime() <= Date.now())
      return res
        .status(400)
        .json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invite token expired' } });

    const existingMember = await Member.findOne({
      workspaceId: invite.workspaceId._id,
      userId: req.user.id
    });
    if (existingMember)
      return res
        .status(400)
        .json({ success: false, error: { code: 'BAD_REQUEST', message: 'Already a member' } });

    const member = await Member.create({
      workspaceId: invite.workspaceId._id,
      userId: req.user.id,
      role: invite.role
    });

    try {
      const user = await User.findById(req.user.id).select('name');
      const description = `${user?.name || 'Someone'} joined the workspace`;
      await logActivity(invite.workspaceId._id, req.user.id, 'member_joined', description, {});
    } catch (err) {
      // Activity logging is non-critical — do not fail the request
    }

    invite.usedAt = new Date();
    invite.usedBy = req.user.id;
    await invite.save();

    return res.status(201).json({ success: true, member });
  })
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:workspaceId
// ---------------------------------------------------------------------------

router.get(
  '/:workspaceId',
  authMiddleware,
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const membership = await getMembership(req.params.workspaceId, req.user.id);
    if (!membership)
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this workspace' }
      });

    return res.json({
      success: true,
      workspace: {
        id: membership.workspaceId._id,
        name: membership.workspaceId.name,
        slug: membership.workspaceId.slug,
        description: membership.workspaceId.description,
        logo: membership.workspaceId.logo,
        color: membership.workspaceId.color,
        ownerId: membership.workspaceId.ownerId,
        createdAt: membership.workspaceId.createdAt,
        role: membership.role
      },
      member: membership
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:workspaceId/stats
// ---------------------------------------------------------------------------

router.get(
  '/:workspaceId/stats',
  authMiddleware,
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const membership = await getMembership(req.params.workspaceId, req.user.id);
    if (!membership)
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this workspace' }
      });

    const workspaceId = membership.workspaceId._id;
    const now = new Date();

    const [columns, totalTasks, activeUsers, overdueTasks] = await Promise.all([
      Column.find({ workspaceId }).lean(),
      Task.countDocuments({ workspaceId }),
      ActivityLog.distinct('userId', { workspaceId, createdAt: { $gte: startOfDay(now) } }),
      Task.find({ workspaceId, dueDate: { $lt: now, $ne: null } })
        .select('columnId')
        .lean()
    ]);

    const doneColumnIds = columns.filter((c) => isDoneColumnName(c.name)).map((c) => c._id);
    const completedThisWeek = doneColumnIds.length
      ? await Task.countDocuments({
          workspaceId,
          columnId: { $in: doneColumnIds },
          updatedAt: { $gte: startOfWeek(now) }
        })
      : 0;

    const overdueCount = overdueTasks.filter(
      (t) => !doneColumnIds.some((id) => String(id) === String(t.columnId))
    ).length;

    const statsPayload = {
      success: true,
      stats: {
        totalTasks,
        completedThisWeek,
        activeMembers: activeUsers.length,
        overdueTasks: overdueCount
      }
    };
    // ETag caching — stats change infrequently; saves 200 round-trips for dashboards
    if (sendWithETag(req, res, statsPayload, now)) return;
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/workspaces/:workspaceId
// ---------------------------------------------------------------------------

router.patch(
  '/:workspaceId',
  authMiddleware,
  validateObjectId('workspaceId'),
  requireRole('owner', 'admin'),
  validate(updateWorkspaceSchema),
  asyncHandler(async (req, res) => {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });

    const { name, description, logo, color } = req.body;
    if (name !== undefined) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (logo !== undefined) workspace.logo = logo;
    if (color !== undefined) workspace.color = color;

    workspace.slug = await createUniqueSlug(workspace.name, workspace._id);
    await workspace.save();

    return res.json({ success: true, workspace });
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/workspaces/:workspaceId
// ---------------------------------------------------------------------------

router.delete(
  '/:workspaceId',
  authMiddleware,
  validateObjectId('workspaceId'),
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });

    await Promise.all([
      Member.deleteMany({ workspaceId: workspace._id }),
      InviteToken.deleteMany({ workspaceId: workspace._id }),
      Board.deleteMany({ workspaceId: workspace._id }),
      Column.deleteMany({ workspaceId: workspace._id }),
      Task.deleteMany({ workspaceId: workspace._id }),
      Comment.deleteMany({ workspaceId: workspace._id }),
      ActivityLog.deleteMany({ workspaceId: workspace._id }),
      Notification.deleteMany({ workspaceId: workspace._id }),
      Workspace.deleteOne({ _id: workspace._id })
    ]);

    return res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:workspaceId/invite
// ---------------------------------------------------------------------------

router.post(
  '/:workspaceId/invite',
  authMiddleware,
  validateObjectId('workspaceId'),
  requireRole('owner', 'admin'),
  validate(inviteSchema),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const { rawToken } = await InviteToken.createWithToken({
      workspaceId: workspace._id,
      createdBy: req.user.id,
      role,
      expiresAt
    });

    return res.json({
      success: true,
      inviteUrl: `${process.env.CLIENT_URL}/join/${rawToken}`,
      expiresAt
    });
  })
);

module.exports = router;
