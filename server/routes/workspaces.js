const express = require('express');
const crypto = require('crypto');

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
const { logActivity } = require('../services/activityService');
const User = require('../models/User');

const router = express.Router();

async function getMembership(workspaceId, userId) {
  return Member.findOne({ workspaceId, userId }).populate('workspaceId');
}

async function createUniqueSlug(name, workspaceIdToIgnore = null) {
  const baseSlug = String(name || 'workspace')
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

    if (!conflict) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function validateColor(color) {
  return !color || /^#[0-9a-fA-F]{6}$/.test(color);
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

router.get('/join/:token', async (req, res) => {
  try {
    const invite = await InviteToken.findOne({ token: req.params.token }).populate('workspaceId');

    if (!invite) {
      return res.json({ valid: false, reason: 'invalid' });
    }

    if (invite.usedAt) {
      return res.json({ valid: false, reason: 'used' });
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      return res.json({ valid: false, reason: 'expired' });
    }

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
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description = '', logo = 'S', color = '#6366f1' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    if (!validateColor(color)) {
      return res.status(400).json({ error: 'Invalid color' });
    }

    const slug = await createUniqueSlug(name);

    const workspace = await Workspace.create({
      name: String(name).trim(),
      slug,
      description: String(description || '').trim(),
      logo: String(logo || 'S').trim(),
      color,
      ownerId: req.user.id
    });

    const member = await Member.create({
      workspaceId: workspace._id,
      userId: req.user.id,
      role: 'owner'
    });

    return res.status(201).json({ workspace, member });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'Already exists' });
    }

    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const memberships = await Member.find({ userId: req.user.id }).populate('workspaceId');

    return res.json({
      workspaces: memberships
        .filter((membership) => membership.workspaceId)
        .map((membership) => ({
          id: membership.workspaceId._id,
          name: membership.workspaceId.name,
          slug: membership.workspaceId.slug,
          description: membership.workspaceId.description,
          logo: membership.workspaceId.logo,
          color: membership.workspaceId.color,
          ownerId: membership.workspaceId.ownerId,
          createdAt: membership.workspaceId.createdAt,
          role: membership.role
        }))
    });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/join/:token', authMiddleware, async (req, res) => {
  try {
    const invite = await InviteToken.findOne({ token: req.params.token }).populate('workspaceId');

    if (!invite) {
      return res.status(404).json({ error: 'Invalid invite token' });
    }

    if (invite.usedAt) {
      return res.status(400).json({ error: 'Invite token already used' });
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Invite token expired' });
    }

    const existingMember = await Member.findOne({ workspaceId: invite.workspaceId._id, userId: req.user.id });

    if (existingMember) {
      return res.status(400).json({ error: 'Already a member' });
    }

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
      console.error('member join activity failed', err && err.message);
    }

    invite.usedAt = new Date();
    invite.usedBy = req.user.id;
    await invite.save();

    return res.status(201).json({ member });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/:workspaceId', authMiddleware, async (req, res) => {
  try {
    const membership = await getMembership(req.params.workspaceId, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    return res.json({
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
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/:workspaceId/stats', authMiddleware, async (req, res) => {
  try {
    const membership = await getMembership(req.params.workspaceId, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const workspaceId = membership.workspaceId._id;
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);

    const [columns, totalTasks, activeUsers, overdueTasks] = await Promise.all([
      Column.find({ workspaceId }),
      Task.countDocuments({ workspaceId }),
      ActivityLog.distinct('userId', { workspaceId, createdAt: { $gte: todayStart } }),
      Task.find({ workspaceId, dueDate: { $lt: now, $ne: null } }).select('columnId')
    ]);

    const doneColumnIds = columns.filter((column) => isDoneColumnName(column.name)).map((column) => column._id);
    const completedThisWeek = doneColumnIds.length
      ? await Task.countDocuments({ workspaceId, columnId: { $in: doneColumnIds }, updatedAt: { $gte: weekStart } })
      : 0;

    const overdueCount = overdueTasks.filter((task) => !doneColumnIds.some((columnId) => String(columnId) === String(task.columnId))).length;

    return res.json({
      stats: {
        totalTasks,
        completedThisWeek,
        activeMembers: activeUsers.length,
        overdueTasks: overdueCount
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/:workspaceId', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { name, description = '', logo = 'S', color = '#6366f1' } = req.body;
    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (!validateColor(color)) {
      return res.status(400).json({ error: 'Invalid color' });
    }

    workspace.name = String(name || workspace.name).trim();
    workspace.description = String(description || '').trim();
    workspace.logo = String(logo || 'S').trim();
    workspace.color = color;
    workspace.slug = await createUniqueSlug(workspace.name, workspace._id);

    await workspace.save();

    return res.json({ workspace });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:workspaceId', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

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
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/:workspaceId/invite', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { role = 'member' } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid invite role' });
    }

    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await InviteToken.create({
      workspaceId: workspace._id,
      token,
      createdBy: req.user.id,
      role,
      expiresAt
    });

    return res.json({
      inviteUrl: `${process.env.CLIENT_URL}/join/${token}`,
      expiresAt
    });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;