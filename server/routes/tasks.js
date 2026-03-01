const express = require('express');

const Task = require('../models/Task');
const Column = require('../models/Column');
const Board = require('../models/Board');
const Workspace = require('../models/Workspace');
const Member = require('../models/Member');
const User = require('../models/User');
const Comment = require('../models/Comment');
const authMiddleware = require('../middleware/authMiddleware');
const { logActivity, notifyUser } = require('../services/activityService');

const router = express.Router();

async function ensureWorkspaceMember(workspaceId, userId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return { error: 'Workspace not found' };
  }

  const member = await Member.findOne({ workspaceId, userId });
  if (!member) {
    return { error: 'Not a member of this workspace' };
  }

  return { workspace, member };
}

async function ensureBoard(boardId, workspaceId) {
  return Board.findOne({ _id: boardId, workspaceId });
}

async function serializeTask(task) {
  const assignee = task.assigneeId ? await User.findById(task.assigneeId).select('name email avatar') : null;
  return {
    id: task._id,
    boardId: task.boardId,
    columnId: task.columnId,
    workspaceId: task.workspaceId,
    title: task.title,
    description: task.description,
    assigneeId: task.assigneeId,
    assignee,
    priority: task.priority,
    dueDate: task.dueDate,
    order: task.order,
    labels: task.labels,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

router.post('/:workspaceId/boards/:boardId/tasks', authMiddleware, async (req, res) => {
  try {
    const { workspace, member, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const board = await ensureBoard(req.params.boardId, workspace._id);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const { title, description = '', columnId, assigneeId = null, priority = 'medium', dueDate = null, labels = [] } = req.body;
    if (!title || !columnId) {
      return res.status(400).json({ error: 'Title and column are required' });
    }



    const column = await Column.findOne({ _id: columnId, boardId: board._id, workspaceId: workspace._id });
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    const order = (await Task.countDocuments({ boardId: board._id, columnId: column._id, workspaceId: workspace._id })) + 1;
    const task = await Task.create({
      boardId: board._id,
      columnId: column._id,
      workspaceId: workspace._id,
      title: String(title).trim(),
      description: String(description).trim(),
      assigneeId: assigneeId || null,
      priority,
      dueDate: dueDate || null,
      order,
      labels,
      createdBy: req.user.id
    });

    const io = req.app.get('io');
    const serialized = await serializeTask(task);
    const payload = { task: serialized, senderId: req.user.id };
    console.log(`emitting task:created to board:${board._id}`, { boardId: String(board._id), taskId: String(task._id) });
    io.to(`board:${board._id}`).emit('task:created', payload);

    try {
      const creator = await User.findById(req.user.id).select('name');
      const description = `${creator?.name || 'Someone'} created task ${task.title}`;
      await logActivity(workspace._id, req.user.id, 'task_created', description, { taskId: String(task._id), boardId: String(board._id) });
      if (task.assigneeId && String(task.assigneeId) !== String(req.user.id)) {
        const link = `/workspace/${workspace._id}/boards/${task.boardId}/tasks/${task._id}`;
        await notifyUser(task.assigneeId, workspace._id, 'task_assigned', `${creator?.name || 'Someone'} assigned you to ${task.title}`, link);
      }
    } catch (err) {
      console.error('post-task activity/notify failed', err && err.message);
    }

    return res.status(201).json({ task: serialized });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/:workspaceId/boards/:boardId/tasks/reorder', authMiddleware, async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const { taskId, fromColumnId, toColumnId, newOrder } = req.body;
    const task = await Task.findOne({ _id: taskId, boardId: req.params.boardId, workspaceId: workspace._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (fromColumnId === toColumnId) {
      const tasks = await Task.find({ boardId: req.params.boardId, workspaceId: workspace._id, columnId: fromColumnId, _id: { $ne: task._id } }).sort({ order: 1 });
      tasks.splice(newOrder - 1, 0, task);
      await Promise.all(tasks.map((item, index) => {
        item.order = index + 1;
        return item.save();
      }));
    } else {
      const fromTasks = await Task.find({ boardId: req.params.boardId, workspaceId: workspace._id, columnId: fromColumnId, _id: { $ne: task._id } }).sort({ order: 1 });
      const toTasks = await Task.find({ boardId: req.params.boardId, workspaceId: workspace._id, columnId: toColumnId, _id: { $ne: task._id } }).sort({ order: 1 });

      toTasks.splice(newOrder - 1, 0, task);

      await Promise.all([
        ...fromTasks.map((item, index) => {
          item.order = index + 1;
          return item.save();
        }),
        ...toTasks.map((item, index) => {
          item.order = index + 1;
          return item.save();
        })
      ]);
    }

    task.columnId = toColumnId;
    task.order = newOrder;
    task.updatedAt = new Date();
    await task.save();

    const io = req.app.get('io');
    const movedPayload = {
      taskId: String(task._id),
      fromColumnId,
      toColumnId,
      newOrder,
      updatedTask: await serializeTask(task),
      senderId: req.user.id
    };
    console.log(`emitting task:moved to board:${task.boardId}`, { boardId: String(task.boardId), taskId: String(task._id) });
    io.to(`board:${task.boardId}`).emit('task:moved', movedPayload);

    try {
      const user = await User.findById(req.user.id).select('name');
      const description = `${user?.name || 'Someone'} moved ${task.title} to column ${toColumnId}`;
      await logActivity(workspace._id, req.user.id, 'task_moved', description, { taskId: String(task._id), fromColumnId, toColumnId });
    } catch (err) {
      console.error('task moved activity failed', err && err.message);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Task reorder failed:', error.message);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
});

router.patch('/:workspaceId/boards/:boardId/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { workspace, member, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const task = await Task.findOne({ _id: req.params.taskId, boardId: req.params.boardId, workspaceId: workspace._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates = req.body;
    const prevAssignee = task.assigneeId ? String(task.assigneeId) : null;


    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined && key in task.toObject()) {
        task[key] = updates[key];
      }
    });
    task.updatedAt = new Date();
    await task.save();

    const io = req.app.get('io');
    const serializedTask = await serializeTask(task);
    io.to(`board:${task.boardId}`).emit('task:updated', { task: serializedTask, senderId: req.user.id });

    try {
      const newAssignee = task.assigneeId ? String(task.assigneeId) : null;
      if (prevAssignee !== newAssignee && newAssignee) {
        const user = await User.findById(req.user.id).select('name');
        const link = `/workspace/${workspace._id}/boards/${task.boardId}/tasks/${task._id}`;
        await notifyUser(newAssignee, workspace._id, 'task_assigned', `${user?.name || 'Someone'} assigned you to ${task.title}`, link);
        await logActivity(workspace._id, req.user.id, 'task_assigned', `${user?.name || 'Someone'} assigned ${task.title} to someone`, { taskId: String(task._id), assigneeId: newAssignee });
      }
    } catch (err) {
      console.error('assignment notify failed', err && err.message);
    }

    return res.json({ task: serializedTask });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:workspaceId/boards/:boardId/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const task = await Task.findOne({ _id: req.params.taskId, boardId: req.params.boardId, workspaceId: workspace._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await Promise.all([
      Task.deleteOne({ _id: task._id }),
      Comment.deleteMany({ taskId: task._id })
    ]);

    const io = req.app.get('io');
    io.to(`board:${task.boardId}`).emit('task:deleted', { taskId: String(task._id), senderId: req.user.id });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;