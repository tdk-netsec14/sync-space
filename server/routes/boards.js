const express = require('express');

const Board = require('../models/Board');
const Column = require('../models/Column');
const Task = require('../models/Task');
const Member = require('../models/Member');
const Workspace = require('../models/Workspace');
const Comment = require('../models/Comment');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/rbacMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const asyncHandler = require('../utils/asyncHandler');
const { sendWithETag } = require('../middleware/etag');
const { logActivity } = require('../services/activityService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureWorkspaceMember(workspaceId, userId) {
  const [workspace, member] = await Promise.all([
    Workspace.findById(workspaceId).lean(),
    Member.findOne({ workspaceId, userId }).lean()
  ]);
  if (!workspace) return { error: 'Workspace not found' };
  if (!member) return { error: 'Not a member of this workspace' };
  return { workspace, member };
}

function validateColor(color) {
  return !color || /^#[0-9a-fA-F]{6}$/.test(color);
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

// ---------------------------------------------------------------------------
// GET /:workspaceId/boards
// ---------------------------------------------------------------------------

router.get(
  '/:workspaceId/boards',
  authMiddleware,
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const { workspace, member, error } = await ensureWorkspaceMember(
      req.params.workspaceId,
      req.user.id
    );
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    // Single aggregation: boards + task counts in one round-trip
    const boards = await Board.aggregate([
      { $match: { workspaceId: workspace._id } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'tasks',
          localField: '_id',
          foreignField: 'boardId',
          pipeline: [{ $count: 'n' }],
          as: '_taskCount'
        }
      },
      {
        $project: {
          id: '$_id',
          workspaceId: 1,
          name: 1,
          description: 1,
          color: 1,
          createdBy: 1,
          createdAt: 1,
          taskCount: { $ifNull: [{ $arrayElemAt: ['$_taskCount.n', 0] }, 0] },
          role: { $literal: member.role }
        }
      }
    ]);

    // ETag caching — board list changes rarely; 304 saves bandwidth
    if (sendWithETag(req, res, { success: true, boards }, new Date())) return;
  })
);

// ---------------------------------------------------------------------------
// POST /:workspaceId/boards
// ---------------------------------------------------------------------------

router.post(
  '/:workspaceId/boards',
  authMiddleware,
  validateObjectId('workspaceId'),
  requireRole('owner', 'admin', 'member'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const { name, description = '', color = '#6366f1' } = req.body;
    if (!name)
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Board name is required' }
      });
    if (!validateColor(color))
      return res
        .status(400)
        .json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid color' } });

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
      defaultColumns.map((col) => ({
        boardId: board._id,
        workspaceId: workspace._id,
        name: col.name,
        order: col.order,
        color
      }))
    );

    const io = req.app.get('io');
    io.to(`workspace:${workspace._id}`).emit('board:created', { board });

    try {
      const creator = await User.findById(req.user.id).select('name').lean();
      const desc = `${creator?.name || 'Someone'} created board ${board.name}`;
      await logActivity(workspace._id, req.user.id, 'board_created', desc, {
        boardId: String(board._id)
      });
    } catch (_) {
      /* non-critical */
    }

    return res.status(201).json({
      success: true,
      board: serializeBoard(board),
      columns: columns.map(serializeColumn)
    });
  })
);

// ---------------------------------------------------------------------------
// GET /:workspaceId/boards/:boardId
//
// N+1 fix: single aggregation fetches board + columns + tasks + assignees
// ---------------------------------------------------------------------------

router.get(
  '/:workspaceId/boards/:boardId',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const board = await Board.findOne({
      _id: req.params.boardId,
      workspaceId: workspace._id
    }).lean();
    if (!board)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Board not found' } });

    // Fetch columns + tasks in two parallel queries (both indexed, both lean)
    const [columns, tasks] = await Promise.all([
      Column.find({ boardId: board._id, workspaceId: workspace._id }).sort({ order: 1 }).lean(),
      Task.find({ boardId: board._id, workspaceId: workspace._id }).sort({ order: 1 }).lean()
    ]);

    // Collect unique assignee IDs then bulk-fetch users — eliminates N+1
    const assigneeIds = [
      ...new Set(tasks.map((t) => String(t.assigneeId)).filter((id) => id && id !== 'null'))
    ];
    const assigneeMap = new Map();
    if (assigneeIds.length) {
      const assignees = await User.find({ _id: { $in: assigneeIds } })
        .select('name email avatar')
        .lean();
      assignees.forEach((u) => assigneeMap.set(String(u._id), u));
    }

    // Shape the response: columns with their tasks nested
    const columnDocs = columns.map((column) => ({
      id: column._id,
      boardId: column.boardId,
      workspaceId: column.workspaceId,
      name: column.name,
      order: column.order,
      color: column.color,
      createdAt: column.createdAt,
      tasks: tasks
        .filter((t) => String(t.columnId) === String(column._id))
        .map((t) => ({
          id: t._id,
          boardId: t.boardId,
          columnId: t.columnId,
          workspaceId: t.workspaceId,
          title: t.title,
          description: t.description,
          assigneeId: t.assigneeId,
          assignee: t.assigneeId ? assigneeMap.get(String(t.assigneeId)) || null : null,
          priority: t.priority,
          dueDate: t.dueDate,
          order: t.order,
          labels: t.labels,
          createdBy: t.createdBy,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt
        }))
    }));

    return res.json({
      success: true,
      board: {
        id: board._id,
        workspaceId: board.workspaceId,
        name: board.name,
        description: board.description,
        color: board.color,
        createdBy: board.createdBy,
        createdAt: board.createdAt
      },
      columns: columnDocs
    });
  })
);

// ---------------------------------------------------------------------------
// PATCH /:workspaceId/boards/:boardId
// ---------------------------------------------------------------------------

router.patch(
  '/:workspaceId/boards/:boardId',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId'),
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const board = await Board.findOne({ _id: req.params.boardId, workspaceId: workspace._id });
    if (!board)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Board not found' } });

    const { name, description, color } = req.body;
    if (name !== undefined) board.name = String(name).trim();
    if (description !== undefined) board.description = String(description).trim();
    if (color !== undefined) {
      if (!validateColor(color))
        return res
          .status(400)
          .json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid color' } });
      board.color = color;
    }
    await board.save();

    const io = req.app.get('io');
    io.to(`workspace:${workspace._id}`).emit('board:updated', { board: serializeBoard(board) });

    return res.json({ success: true, board: serializeBoard(board) });
  })
);

// ---------------------------------------------------------------------------
// DELETE /:workspaceId/boards/:boardId
// ---------------------------------------------------------------------------

router.delete(
  '/:workspaceId/boards/:boardId',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId'),
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const board = await Board.findOne({
      _id: req.params.boardId,
      workspaceId: workspace._id
    }).lean();
    if (!board)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Board not found' } });

    await Promise.all([
      Task.deleteMany({ boardId: board._id, workspaceId: workspace._id }),
      Column.deleteMany({ boardId: board._id, workspaceId: workspace._id }),
      Comment.deleteMany({ boardId: board._id, workspaceId: workspace._id }),
      Board.deleteOne({ _id: board._id })
    ]);

    return res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// POST /:workspaceId/boards/:boardId/columns
// ---------------------------------------------------------------------------

router.post(
  '/:workspaceId/boards/:boardId/columns',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId'),
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const board = await Board.findOne({
      _id: req.params.boardId,
      workspaceId: workspace._id
    }).lean();
    if (!board)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Board not found' } });

    const { name, color = '#e2e8f0' } = req.body;
    if (!name)
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Column name is required' }
      });

    const maxOrderDoc = await Column.findOne({ boardId: board._id })
      .sort({ order: -1 })
      .select('order')
      .lean();
    const column = await Column.create({
      boardId: board._id,
      workspaceId: workspace._id,
      name: String(name).trim(),
      color,
      order: (maxOrderDoc?.order ?? -1) + 1
    });

    return res.status(201).json({ success: true, column: serializeColumn(column) });
  })
);

// ---------------------------------------------------------------------------
// PATCH /:workspaceId/boards/:boardId/columns/:columnId
// ---------------------------------------------------------------------------

router.patch(
  '/:workspaceId/boards/:boardId/columns/:columnId',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId', 'columnId'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const column = await Column.findOne({
      _id: req.params.columnId,
      boardId: req.params.boardId,
      workspaceId: workspace._id
    });
    if (!column)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Column not found' } });

    const { name, color } = req.body;
    if (name !== undefined) column.name = String(name).trim();
    if (color !== undefined) column.color = color;

    await column.save();
    return res.json({ success: true, column: serializeColumn(column) });
  })
);

// ---------------------------------------------------------------------------
// DELETE /:workspaceId/boards/:boardId/columns/:columnId
// ---------------------------------------------------------------------------

router.delete(
  '/:workspaceId/boards/:boardId/columns/:columnId',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId', 'columnId'),
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const column = await Column.findOne({
      _id: req.params.columnId,
      boardId: req.params.boardId,
      workspaceId: workspace._id
    }).lean();
    if (!column)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Column not found' } });

    const taskCount = await Task.countDocuments({
      columnId: column._id,
      boardId: req.params.boardId,
      workspaceId: workspace._id
    });
    if (taskCount > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Move tasks before deleting' }
      });
    }

    await Column.deleteOne({ _id: column._id });
    return res.json({ success: true });
  })
);

module.exports = router;
