const express = require('express');

const ActivityLog = require('../models/ActivityLog');
const Member = require('../models/Member');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

async function ensureWorkspaceMember(workspaceId, userId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return { error: 'Workspace not found' };
  const member = await Member.findOne({ workspaceId, userId });
  if (!member) return { error: 'Not a member of this workspace' };
  return { workspace, member };
}

router.get('/:workspaceId/activity', authMiddleware, async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) return res.status(403).json({ error });

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const before = req.query.before ? new Date(req.query.before) : null;

    const filter = { workspaceId: workspace._id };
    if (before) filter.createdAt = { $lt: before };

    const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit).populate('userId', 'name avatar');

    const activities = logs.map((l) => ({
      id: l._id,
      user: l.userId ? { id: l.userId._id, name: l.userId.name, avatar: l.userId.avatar } : null,
      type: l.type,
      description: l.description,
      metadata: l.metadata,
      createdAt: l.createdAt
    }));

    return res.json({ activities });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
