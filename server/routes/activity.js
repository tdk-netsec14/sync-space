const express = require('express');

const ActivityLog = require('../models/ActivityLog');
const Member = require('../models/Member');
const Workspace = require('../models/Workspace');
const authMiddleware = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const asyncHandler = require('../utils/asyncHandler');
const { parsePaginationQuery, applyCursor, buildMeta } = require('../utils/paginate');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureWorkspaceMember(workspaceId, userId) {
  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) return { error: 'Workspace not found' };
  const member = await Member.findOne({ workspaceId, userId }).lean();
  if (!member) return { error: 'Not a member of this workspace' };
  return { workspace, member };
}

// ---------------------------------------------------------------------------
// GET /:workspaceId/activity
//
// Cursor-based pagination via ?before=<ISO-date>&limit=<n>
// Default: 20, max: 100
// Returns: { success, activities, hasMore, nextCursor, count }
// ---------------------------------------------------------------------------

router.get(
  '/:workspaceId/activity',
  authMiddleware,
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const { limit, before } = parsePaginationQuery(req.query);

    // Build cursor filter merged with workspace constraint
    const filter = applyCursor({ before, after: null }, { workspaceId: workspace._id });

    // Single aggregation: fetch activity + join user in one round-trip (no N+1)
    const activities = await ActivityLog.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, avatar: 1 } }],
          as: '_user'
        }
      },
      {
        $project: {
          id: '$_id',
          type: 1,
          description: 1,
          metadata: 1,
          createdAt: 1,
          user: {
            $cond: {
              if: { $gt: [{ $size: '$_user' }, 0] },
              then: {
                id: { $arrayElemAt: ['$_user._id', 0] },
                name: { $arrayElemAt: ['$_user.name', 0] },
                avatar: { $arrayElemAt: ['$_user.avatar', 0] }
              },
              else: null
            }
          }
        }
      }
    ]);

    const meta = buildMeta(activities, { limit });

    return res.json({ success: true, activities, ...meta });
  })
);

module.exports = router;
