const express = require('express');
const { z } = require('zod');

const Comment = require('../models/Comment');
const Task = require('../models/Task');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Member = require('../models/Member');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity, notifyUser } = require('../services/activityService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const commentBodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(2000, 'Content is too long (max 2000 characters)')
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeComment(comment, author) {
  return {
    id: comment._id,
    taskId: comment.taskId,
    boardId: comment.boardId,
    workspaceId: comment.workspaceId,
    author: author
      ? {
          id: author._id || author.id,
          name: author.name,
          email: author.email,
          avatar: author.avatar
        }
      : null,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

async function ensureWorkspaceMember(workspaceId, userId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return { error: 'Workspace not found' };
  const member = await Member.findOne({ workspaceId, userId });
  if (!member) return { error: 'Not a member of this workspace' };
  return { workspace, member };
}

// ---------------------------------------------------------------------------
// GET /:workspaceId/tasks/:taskId/comments
// ---------------------------------------------------------------------------

router.get(
  '/:workspaceId/tasks/:taskId/comments',
  authMiddleware,
  validateObjectId('workspaceId', 'taskId'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const comments = await Comment.find({
      taskId: req.params.taskId,
      workspaceId: workspace._id
    })
      .sort({ createdAt: 1 })
      .populate('authorId', 'name email avatar')
      .lean();

    return res.json({
      success: true,
      comments: comments.map((c) => serializeComment(c, c.authorId))
    });
  })
);

// ---------------------------------------------------------------------------
// POST /:workspaceId/tasks/:taskId/comments
// ---------------------------------------------------------------------------

router.post(
  '/:workspaceId/tasks/:taskId/comments',
  authMiddleware,
  validateObjectId('workspaceId', 'taskId'),
  validate(commentBodySchema),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const task = await Task.findOne({ _id: req.params.taskId, workspaceId: workspace._id }).lean();
    if (!task)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

    const { content } = req.body;

    const comment = await Comment.create({
      taskId: task._id,
      boardId: task.boardId,
      workspaceId: workspace._id,
      authorId: req.user.id,
      content
    });

    const author = await User.findById(req.user.id).select('name email avatar');
    const description = `${author?.name || 'Someone'} commented on ${task.title}`;

    try {
      await logActivity(workspace._id, req.user.id, 'task_commented', description, {
        taskId: String(task._id),
        boardId: String(task.boardId)
      });
      if (task.assigneeId && String(task.assigneeId) !== String(req.user.id)) {
        const link = `/workspace/${workspace._id}/boards/${task.boardId}/tasks/${task._id}`;
        await notifyUser(task.assigneeId, workspace._id, 'task_commented', description, link);
      }
    } catch (_) {
      /* non-critical */
    }

    const io = req.app.get('io');
    const payload = {
      comment: serializeComment(comment, {
        _id: req.user.id,
        name: author?.name,
        email: author?.email,
        avatar: author?.avatar
      })
    };
    io.to(`board:${String(task.boardId)}`).emit('comment:created', payload);

    return res.status(201).json({ success: true, ...payload });
  })
);

// ---------------------------------------------------------------------------
// PATCH /:workspaceId/tasks/:taskId/comments/:commentId
// ---------------------------------------------------------------------------

router.patch(
  '/:workspaceId/tasks/:taskId/comments/:commentId',
  authMiddleware,
  validateObjectId('workspaceId', 'taskId', 'commentId'),
  validate(commentBodySchema),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const comment = await Comment.findOne({
      _id: req.params.commentId,
      taskId: req.params.taskId,
      workspaceId: workspace._id
    });
    if (!comment)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } });
    if (String(comment.authorId) !== String(req.user.id)) {
      return res
        .status(403)
        .json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    comment.content = req.body.content;
    comment.updatedAt = new Date();
    await comment.save();

    const io = req.app.get('io');
    const author = await User.findById(comment.authorId).select('name email avatar');
    const payload = { comment: serializeComment(comment, author) };
    io.to(`board:${String(comment.boardId)}`).emit('comment:updated', payload);

    return res.json({ success: true, ...payload });
  })
);

// ---------------------------------------------------------------------------
// DELETE /:workspaceId/tasks/:taskId/comments/:commentId
// ---------------------------------------------------------------------------

router.delete(
  '/:workspaceId/tasks/:taskId/comments/:commentId',
  authMiddleware,
  validateObjectId('workspaceId', 'taskId', 'commentId'),
  asyncHandler(async (req, res) => {
    const { workspace, member, error } = await ensureWorkspaceMember(
      req.params.workspaceId,
      req.user.id
    );
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const comment = await Comment.findOne({
      _id: req.params.commentId,
      taskId: req.params.taskId,
      workspaceId: workspace._id
    });
    if (!comment)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } });

    const isAuthor = String(comment.authorId) === String(req.user.id);
    const isAdmin = member.role === 'owner' || member.role === 'admin';
    if (!isAuthor && !isAdmin) {
      return res
        .status(403)
        .json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    await Comment.deleteOne({ _id: comment._id });

    const io = req.app.get('io');
    io.to(`board:${String(comment.boardId)}`).emit('comment:deleted', {
      commentId: String(comment._id)
    });

    return res.json({ success: true });
  })
);

module.exports = router;
