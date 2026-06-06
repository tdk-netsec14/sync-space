const express = require('express');

const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const { parsePaginationQuery, applyCursor, buildMeta } = require('../utils/paginate');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/notifications
//
// Cursor-based pagination via ?before=<ISO-date>&limit=<n>
// Default: 20, max: 100
// ---------------------------------------------------------------------------

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { limit, before } = parsePaginationQuery(req.query);
    const filter = applyCursor({ before, after: null }, { userId: req.user.id });

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const meta = buildMeta(notifications, { limit });

    return res.json({ success: true, notifications, ...meta });
  })
);

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count
// ---------------------------------------------------------------------------

router.get(
  '/unread-count',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({ userId: req.user.id, read: false });
    return res.json({ success: true, count });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/notifications/read-all
// ---------------------------------------------------------------------------

router.patch(
  '/read-all',
  authMiddleware,
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    return res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/notifications/:id/read
// ---------------------------------------------------------------------------

router.patch(
  '/:id/read',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
      { new: true, lean: true }
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    return res.json({ success: true, notification: updated });
  })
);

module.exports = router;
