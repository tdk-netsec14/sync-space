const express = require('express');

const Comment = require('../models/Comment');
const Task = require('../models/Task');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Member = require('../models/Member');
const authMiddleware = require('../middleware/authMiddleware');

const { logActivity, notifyUser } = require('../services/activityService');

const router = express.Router();

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

router.get('/:workspaceId/tasks/:taskId/comments', authMiddleware, async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) return res.status(403).json({ error });

    const comments = await Comment.find({ taskId: req.params.taskId, workspaceId: workspace._id }).sort({ createdAt: 1 }).populate('authorId', 'name email avatar');

    const serialized = comments.map((c) => serializeComment(c, c.authorId));

    return res.json({ comments: serialized });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/:workspaceId/tasks/:taskId/comments', authMiddleware, async (req, res) => {
  try {
    const { workspace, member, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) return res.status(403).json({ error });

    const { content } = req.body;
    if (!content || String(content).trim() === '') return res.status(400).json({ error: 'Content is required' });
    if (String(content).length > 2000) return res.status(400).json({ error: 'Content too long' });

    const task = await Task.findOne({ _id: req.params.taskId, workspaceId: workspace._id });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const comment = await Comment.create({
      taskId: task._id,
      boardId: task.boardId,
      workspaceId: workspace._id,
      authorId: req.user.id,
      content: String(content).trim()
    });

    const author = await User.findById(req.user.id).select('name email avatar');
    const description = `${author?.name || 'Someone'} commented on ${task.title}`;
    await logActivity(workspace._id, req.user.id, 'task_commented', description, { taskId: String(task._id), boardId: String(task.boardId) });

    // notify assignee if present and not the commenter
    if (task.assigneeId && String(task.assigneeId) !== String(req.user.id)) {
      const link = `/workspace/${workspace._id}/boards/${task.boardId}/tasks/${task._id}`;
      await notifyUser(task.assigneeId, workspace._id, 'task_commented', description, link);
    }

    const io = req.app.get('io');
    const payload = { comment: serializeComment(comment, { _id: req.user.id, name: author?.name, email: author?.email, avatar: author?.avatar }) };

    io.to(`board:${String(task.boardId)}`).emit('comment:created', payload);

    return res.status(201).json(payload);
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/:workspaceId/tasks/:taskId/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const { workspace, member, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) return res.status(403).json({ error });

    const comment = await Comment.findOne({ _id: req.params.commentId, taskId: req.params.taskId, workspaceId: workspace._id });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (String(comment.authorId) !== String(req.user.id)) return res.status(403).json({ error: 'Not authorized' });

    const { content } = req.body;
    if (!content || String(content).trim() === '') return res.status(400).json({ error: 'Content is required' });
    if (String(content).length > 2000) return res.status(400).json({ error: 'Content too long' });

    comment.content = String(content).trim();
    comment.updatedAt = new Date();
    await comment.save();

    const io = req.app.get('io');
    const payload = { comment: serializeComment(comment, await User.findById(comment.authorId).select('name email avatar')) };
    io.to(`board:${String(comment.boardId)}`).emit('comment:updated', payload);

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:workspaceId/tasks/:taskId/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const { workspace, member, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) return res.status(403).json({ error });

    const comment = await Comment.findOne({ _id: req.params.commentId, taskId: req.params.taskId, workspaceId: workspace._id });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const isAuthor = String(comment.authorId) === String(req.user.id);
    const isAdmin = member.role === 'owner' || member.role === 'admin';
    if (!isAuthor && !isAdmin) return res.status(403).json({ error: 'Not authorized' });

    await Comment.deleteOne({ _id: comment._id });

    const io = req.app.get('io');
    io.to(`board:${String(comment.boardId)}`).emit('comment:deleted', { commentId: String(comment._id) });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
