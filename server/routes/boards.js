const express = require('express');

const Board = require('../models/Board');
const Column = require('../models/Column');
const Task = require('../models/Task');
const User = require('../models/User');
const Member = require('../models/Member');
const Workspace = require('../models/Workspace');
const Comment = require('../models/Comment');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/rbacMiddleware');
const { logActivity } = require('../services/activityService');

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

function validateColor(color) {
  return !color || /^#[0-9a-fA-F]{6}$/.test(color);
}

async function fetchBoardBundle(boardId) {
  const board = await Board.findById(boardId);
  if (!board) {
    return null;
  }

  const columns = await Column.find({ boardId }).sort({ order: 1 });
  const tasks = await Task.find({ boardId })
    .sort({ order: 1 })
    .populate('assigneeId', 'name email avatar');

  return { board, columns, tasks };
}

function serializeBoard(board, taskCount = 0) {
  return {
    id: board._id,
    workspaceId: board.workspaceId,
    name: board.name,
    description: board.description,
    color: board.color,
    createdBy: board.createdBy,
    createdAt: board.createdAt,
    taskCount
  };
}

function serializeColumn(column) {
  return {
    id: column._id,
    boardId: column.boardId,
    workspaceId: column.workspaceId,
    name: column.name,
    order: column.order,
    color: column.color,
    createdAt: column.createdAt
  };
}

router.get('/:workspaceId/boards', authMiddleware, async (req, res) => {
  try {
    const { workspace, member, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const boards = await Board.find({ workspaceId: workspace._id }).sort({ createdAt: -1 });
    const boardIds = boards.map((board) => board._id);
    const taskCounts = await Task.aggregate([
      { $match: { workspaceId: workspace._id, boardId: { $in: boardIds } } },
      { $group: { _id: '$boardId', count: { $sum: 1 } } }
    ]);
    const countsByBoardId = new Map(taskCounts.map((item) => [String(item._id), item.count]));

    return res.json({
      boards: boards.map((board) => ({
        id: board._id,
        workspaceId: board.workspaceId,
        name: board.name,
        description: board.description,
        color: board.color,
        createdBy: board.createdBy,
        createdAt: board.createdAt,
        taskCount: countsByBoardId.get(String(board._id)) || 0,
        role: member.role
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/:workspaceId/boards', authMiddleware, requireRole('owner', 'admin', 'member'), async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const { name, description = '', color = '#6366f1' } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Board name is required' });
    }

    if (!validateColor(color)) {
      return res.status(400).json({ error: 'Invalid color' });
    }

    const board = await Board.create({
      workspaceId: workspace._id,
      name: String(name).trim(),
      description: String(description).trim(),
      color,
      createdBy: req.user.id
    });

    const defaultColumns = [
      { name: 'Backlog', order: 0 },
      { name: 'In Progress', order: 1 },
      { name: 'In Review', order: 2 },
      { name: 'Done', order: 3 }
    ];

    const columns = await Column.insertMany(
      defaultColumns.map((column) => ({
        boardId: board._id,
        workspaceId: workspace._id,
        name: column.name,
        order: column.order,
        color
      }))
    );

    const io = req.app.get('io');
    io.to(`workspace:${workspace._id}`).emit('board:created', { board });

    try {
      const creator = await User.findById(req.user.id).select('name');
      const description = `${creator?.name || 'Someone'} created board ${board.name}`;
      await logActivity(workspace._id, req.user.id, 'board_created', description, { boardId: String(board._id) });
    } catch (err) {
      console.error('board created activity failed', err && err.message);
    }

    return res.status(201).json({ board: serializeBoard(board), columns: columns.map(serializeColumn) });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/:workspaceId/boards/:boardId', authMiddleware, async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const bundle = await fetchBoardBundle(req.params.boardId);
    if (!bundle || String(bundle.board.workspaceId) !== String(workspace._id)) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const memberMap = new Map();
    const assigneeIds = [...new Set(bundle.tasks.map((task) => task.assigneeId?._id || task.assigneeId).filter(Boolean))].map(String);
    if (assigneeIds.length) {
      const assignees = await User.find({ _id: { $in: assigneeIds } }).select('name email avatar');
      assignees.forEach((user) => memberMap.set(String(user._id), user));
    }

    const columns = bundle.columns.map((column) => ({
      id: column._id,
      boardId: column.boardId,
      workspaceId: column.workspaceId,
      name: column.name,
      order: column.order,
      color: column.color,
      createdAt: column.createdAt,
      tasks: bundle.tasks
        .filter((task) => String(task.columnId) === String(column._id))
        .map((task) => ({
          id: task._id,
          boardId: task.boardId,
          columnId: task.columnId,
          workspaceId: task.workspaceId,
          title: task.title,
          description: task.description,
          assigneeId: task.assigneeId,
          assignee: task.assigneeId ? memberMap.get(String(task.assigneeId._id || task.assigneeId)) || null : null,
          priority: task.priority,
          dueDate: task.dueDate,
          order: task.order,
          labels: task.labels,
          createdBy: task.createdBy,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        }))
    }));

    return res.json({
      board: {
        id: bundle.board._id,
        workspaceId: bundle.board.workspaceId,
        name: bundle.board.name,
        description: bundle.board.description,
        color: bundle.board.color,
        createdBy: bundle.board.createdBy,
        createdAt: bundle.board.createdAt
      },
      columns
    });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/:workspaceId/boards/:boardId', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const board = await Board.findOne({ _id: req.params.boardId, workspaceId: workspace._id });
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const { name, description, color } = req.body;
    if (name !== undefined) {
      board.name = String(name).trim();
    }
    if (description !== undefined) {
      board.description = String(description).trim();
    }
    if (color !== undefined) {
      if (!validateColor(color)) {
        return res.status(400).json({ error: 'Invalid color' });
      }
      board.color = color;
    }

    await board.save();

    const io = req.app.get('io');
    io.to(`workspace:${workspace._id}`).emit('board:updated', { board: serializeBoard(board) });

    return res.json({ board: serializeBoard(board) });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:workspaceId/boards/:boardId', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const board = await Board.findOne({ _id: req.params.boardId, workspaceId: workspace._id });
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    await Promise.all([
      Task.deleteMany({ boardId: board._id, workspaceId: workspace._id }),
      Column.deleteMany({ boardId: board._id, workspaceId: workspace._id }),
      Comment.deleteMany({ boardId: board._id, workspaceId: workspace._id }),
      Board.deleteOne({ _id: board._id })
    ]);

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/:workspaceId/boards/:boardId/columns', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const board = await Board.findOne({ _id: req.params.boardId, workspaceId: workspace._id });
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const { name, color = '#e2e8f0' } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Column name is required' });
    }

    const maxOrder = await Column.findOne({ boardId: board._id }).sort({ order: -1 }).select('order');
    const column = await Column.create({
      boardId: board._id,
      workspaceId: workspace._id,
      name: String(name).trim(),
      color,
      order: (maxOrder?.order ?? -1) + 1
    });

    return res.status(201).json({ column: serializeColumn(column) });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/:workspaceId/boards/:boardId/columns/:columnId', authMiddleware, async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const column = await Column.findOne({ _id: req.params.columnId, boardId: req.params.boardId, workspaceId: workspace._id });
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    const { name, color } = req.body;
    if (name !== undefined) {
      column.name = String(name).trim();
    }
    if (color !== undefined) {
      column.color = color;
    }

    await column.save();
    return res.json({ column: serializeColumn(column) });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:workspaceId/boards/:boardId/columns/:columnId', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) {
      return res.status(403).json({ error });
    }

    const column = await Column.findOne({ _id: req.params.columnId, boardId: req.params.boardId, workspaceId: workspace._id });
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    const taskCount = await Task.countDocuments({ columnId: column._id, boardId: req.params.boardId, workspaceId: workspace._id });
    if (taskCount > 0) {
      return res.status(400).json({ error: 'Move tasks before deleting' });
    }

    await Column.deleteOne({ _id: column._id });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;