const express = require('express');

const Member = require('../models/Member');
const Workspace = require('../models/Workspace');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/rbacMiddleware');

const router = express.Router();

async function getWorkspaceAndMember(workspaceId, userId) {
  const workspace = await Workspace.findById(workspaceId);
  const member = await Member.findOne({ workspaceId, userId });
  return { workspace, member };
}

router.get('/:workspaceId/members', authMiddleware, async (req, res) => {
  try {
    const { workspace, member } = await getWorkspaceAndMember(req.params.workspaceId, req.user.id);

    if (!workspace || !member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const members = await Member.find({ workspaceId: workspace._id }).populate('userId', 'name email avatar');

    return res.json({
      members: members.map((item) => ({
        id: item._id,
        role: item.role,
        joinedAt: item.joinedAt,
        user: item.userId
          ? {
              id: item.userId._id,
              name: item.userId.name,
              email: item.userId.email,
              avatar: item.userId.avatar
            }
          : null
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/:workspaceId/members/:userId', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const { workspace } = await getWorkspaceAndMember(req.params.workspaceId, req.user.id);

    if (!workspace) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    if (!['owner', 'admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const targetMember = await Member.findOne({ workspaceId: workspace._id, userId: req.params.userId });

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (String(workspace.ownerId) === String(targetMember.userId)) {
      return res.status(400).json({ error: "Cannot change owner's role" });
    }

    if (String(req.user.id) === String(targetMember.userId) && req.member.role === 'owner' && role !== 'owner') {
      return res.status(400).json({ error: 'Cannot demote self if owner' });
    }

    targetMember.role = role;
    await targetMember.save();

    return res.json({ member: targetMember });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:workspaceId/members/:userId', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { workspace } = await getWorkspaceAndMember(req.params.workspaceId, req.user.id);

    if (!workspace) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const targetMember = await Member.findOne({ workspaceId: workspace._id, userId: req.params.userId });

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (String(workspace.ownerId) === String(targetMember.userId)) {
      return res.status(400).json({ error: 'Cannot remove owner' });
    }

    if (String(req.user.id) === String(targetMember.userId)) {
      return res.status(400).json({ error: 'Cannot remove self' });
    }

    await Member.deleteOne({ _id: targetMember._id });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:workspaceId/leave', authMiddleware, async (req, res) => {
  try {
    const { workspace, member } = await getWorkspaceAndMember(req.params.workspaceId, req.user.id);

    if (!workspace || !member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    if (String(workspace.ownerId) === String(req.user.id) || member.role === 'owner') {
      return res.status(400).json({ error: 'Cannot leave if you are owner' });
    }

    await Member.deleteOne({ _id: member._id });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;