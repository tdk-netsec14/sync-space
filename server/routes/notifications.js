const express = require('express');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(30);
    return res.json({ notifications });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { read: true }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json({ notification: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, read: false });
    return res.json({ count });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
