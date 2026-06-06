const express = require('express');

const Member = require('../models/Member');
const Workspace = require('../models/Workspace');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/rbacMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const asyncHandler = require('../utils/asyncHandler');
const { parsePaginationQuery, applyCursor, buildMeta } = require('../utils/paginate');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getWorkspaceAndMember(workspaceId, userId) {
  const [workspace, member] = await Promise.all([
    Workspace.findById(workspaceId).lean(),
    Member.findOne({ workspaceId, userId }).lean()
  ]);
  return { workspace, member };
}

// ---------------------------------------------------------------------------
// GET /:workspaceId/members
//
// Cursor-based pagination via ?after=<ObjectId>&limit=<n>
// Default: 20, max: 100
// ---------------------------------------------------------------------------

router.get(
  '/:workspaceId/members',
  authMiddleware,
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const { workspace, member } = await getWorkspaceAndMember(req.params.workspaceId, req.user.id);
    if (!workspace || !member) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this workspace' }
      });
    }

    const { limit, after } = parsePaginationQuery(req.query);
    const filter = applyCursor({ before: null, after }, { workspaceId: workspace._id });

    // Single $lookup aggregation — avoids N+1 populate on each member
    const members = await Member.aggregate([
      { $match: filter },
      { $sort: { _id: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, email: 1, avatar: 1 } }],
          as: '_user'
        }
      },
      {
        $project: {
          id: '$_id',
          role: 1,
          joinedAt: 1,
          user: {
            $cond: {
              if: { $gt: [{ $size: '$_user' }, 0] },
              then: {
                id: { $arrayElemAt: ['$_user._id', 0] },
                name: { $arrayElemAt: ['$_user.name', 0] },
                email: { $arrayElemAt: ['$_user.email', 0] },
                avatar: { $arrayElemAt: ['$_user.avatar', 0] }
              },
              else: null
            }
          }
        }
      }
    ]);

    const meta = buildMeta(members, { limit });

    return res.json({ success: true, members, ...meta });
  })
);

// ---------------------------------------------------------------------------
// PATCH /:workspaceId/members/:userId — change role
// ---------------------------------------------------------------------------

router.patch(
  '/:workspaceId/members/:userId',
  authMiddleware,
  validateObjectId('workspaceId'),
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    const workspace = await Workspace.findById(req.params.workspaceId).lean();
    if (!workspace)
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this workspace' }
      });

    if (!['owner', 'admin', 'member'].includes(role)) {
      return res
        .status(400)
        .json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid role' } });
    }

    const targetMember = await Member.findOne({
      workspaceId: workspace._id,
      userId: req.params.userId
    });
    if (!targetMember)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } });

    if (String(workspace.ownerId) === String(targetMember.userId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: "Cannot change owner's role" }
      });
    }

    targetMember.role = role;
    await targetMember.save();

    return res.json({ success: true, member: targetMember });
  })
);

// ---------------------------------------------------------------------------
// DELETE /:workspaceId/members/:userId — remove member
// ---------------------------------------------------------------------------

router.delete(
  '/:workspaceId/members/:userId',
  authMiddleware,
  validateObjectId('workspaceId'),
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const workspace = await Workspace.findById(req.params.workspaceId).lean();
    if (!workspace)
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this workspace' }
      });

    const targetMember = await Member.findOne({
      workspaceId: workspace._id,
      userId: req.params.userId
    });
    if (!targetMember)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } });

    if (String(workspace.ownerId) === String(targetMember.userId)) {
      return res
        .status(400)
        .json({ success: false, error: { code: 'BAD_REQUEST', message: 'Cannot remove owner' } });
    }
    if (String(req.user.id) === String(targetMember.userId)) {
      return res
        .status(400)
        .json({ success: false, error: { code: 'BAD_REQUEST', message: 'Cannot remove self' } });
    }

    await Member.deleteOne({ _id: targetMember._id });
    return res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// DELETE /:workspaceId/leave
// ---------------------------------------------------------------------------

router.delete(
  '/:workspaceId/leave',
  authMiddleware,
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const { workspace, member } = await getWorkspaceAndMember(req.params.workspaceId, req.user.id);
    if (!workspace || !member) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this workspace' }
      });
    }
    if (String(workspace.ownerId) === String(req.user.id) || member.role === 'owner') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Cannot leave if you are owner' }
      });
    }

    await Member.deleteOne({ _id: member._id });
    return res.json({ success: true });
  })
);

module.exports = router;
