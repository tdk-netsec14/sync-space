const express = require('express');
const { z } = require('zod');

const Task = require('../models/Task');
const Column = require('../models/Column');
const Board = require('../models/Board');
const Workspace = require('../models/Workspace');
const Member = require('../models/Member');
const User = require('../models/User');
const Comment = require('../models/Comment');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity, notifyUser } = require('../services/activityService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const PRIORITY_ENUM = z.enum(['low', 'medium', 'high', 'critical'], {
  errorMap: () => ({ message: 'Priority must be one of: low, medium, high, critical' })
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().trim().max(2000, 'Description is too long').optional().default(''),
  columnId: z.string().min(1, 'Column is required'),
  assigneeId: z.string().nullable().optional().default(null),
  priority: PRIORITY_ENUM.optional().default('medium'),
  dueDate: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .nullable()
    .optional()
    .default(null),
  labels: z
    .array(z.string().trim().max(50, 'Label is too long'))
    .max(10, 'Maximum 10 labels allowed')
    .optional()
    .default([])
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long').optional(),
    description: z.string().trim().max(2000, 'Description is too long').optional(),
    columnId: z.string().optional(),
    assigneeId: z.string().nullable().optional(),
    priority: PRIORITY_ENUM.optional(),
    dueDate: z.string().datetime({ message: 'Invalid date format' }).nullable().optional(),
    labels: z
      .array(z.string().trim().max(50, 'Label is too long'))
      .max(10, 'Maximum 10 labels allowed')
      .optional()
  })
  .strict();

const reorderSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  fromColumnId: z.string().min(1, 'fromColumnId is required'),
  toColumnId: z.string().min(1, 'toColumnId is required'),
  newOrder: z.number().int().min(1, 'newOrder must be a positive integer')
});

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

async function ensureBoard(boardId, workspaceId) {
  return Board.findOne({ _id: boardId, workspaceId }).lean();
}

/**
 * Serializes a task document to the API shape.
 * Performs a single user lookup when an assigneeId exists — kept as a
 * necessary point query after a write/mutate (not a list scan).
 */
async function serializeTask(task) {
  const assignee = task.assigneeId
    ? await User.findById(task.assigneeId).select('name email avatar').lean()
    : null;
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

// Explicit allowlist — prevents mass-assignment of internal fields
const UPDATABLE_TASK_FIELDS = [
  'title',
  'description',
  'columnId',
  'assigneeId',
  'priority',
  'dueDate',
  'labels'
];

// ---------------------------------------------------------------------------
// POST /:workspaceId/boards/:boardId/tasks
// ---------------------------------------------------------------------------

router.post(
  '/:workspaceId/boards/:boardId/tasks',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId'),
  validate(createTaskSchema),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const board = await ensureBoard(req.params.boardId, workspace._id);
    if (!board)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Board not found' } });

    const { title, description, columnId, assigneeId, priority, dueDate, labels } = req.body;

    const column = await Column.findOne({
      _id: columnId,
      boardId: board._id,
      workspaceId: workspace._id
    }).lean();
    if (!column)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Column not found' } });

    const order =
      (await Task.countDocuments({
        boardId: board._id,
        columnId: column._id,
        workspaceId: workspace._id
      })) + 1;

    const task = await Task.create({
      boardId: board._id,
      columnId: column._id,
      workspaceId: workspace._id,
      title,
      description,
      assigneeId: assigneeId || null,
      priority,
      dueDate: dueDate || null,
      order,
      labels,
      createdBy: req.user.id
    });

    const io = req.app.get('io');
    const serialized = await serializeTask(task);
    io.to(`board:${board._id}`).emit('task:created', { task: serialized, senderId: req.user.id });

    try {
      const creator = await User.findById(req.user.id).select('name').lean();
      const desc = `${creator?.name || 'Someone'} created task ${task.title}`;
      await logActivity(workspace._id, req.user.id, 'task_created', desc, {
        taskId: String(task._id),
        boardId: String(board._id)
      });
      if (task.assigneeId && String(task.assigneeId) !== String(req.user.id)) {
        const link = `/workspace/${workspace._id}/boards/${task.boardId}/tasks/${task._id}`;
        await notifyUser(
          task.assigneeId,
          workspace._id,
          'task_assigned',
          `${creator?.name || 'Someone'} assigned you to ${task.title}`,
          link
        );
      }
    } catch (_) {
      /* non-critical */
    }

    return res.status(201).json({ success: true, task: serialized });
  })
);

// ---------------------------------------------------------------------------
// PATCH /:workspaceId/boards/:boardId/tasks/reorder
//
// Idempotency guarantees:
//   1. Task must belong to the given boardId AND workspaceId (ownership check)
//   2. fromColumnId and toColumnId must belong to the same board (column ownership)
//   3. Re-running the same request leaves the DB in the same state (order re-computed)
// ---------------------------------------------------------------------------

router.patch(
  '/:workspaceId/boards/:boardId/tasks/reorder',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId'),
  validate(reorderSchema),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const { taskId, fromColumnId, toColumnId, newOrder } = req.body;

    // Idempotency: verify the task belongs to this board/workspace
    const task = await Task.findOne({
      _id: taskId,
      boardId: req.params.boardId,
      workspaceId: workspace._id
    });
    if (!task)
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found or does not belong to this board' }
      });

    // Idempotency: verify both columns belong to this board (prevents cross-board moves)
    const [fromCol, toCol] = await Promise.all([
      Column.findOne({
        _id: fromColumnId,
        boardId: req.params.boardId,
        workspaceId: workspace._id
      }).lean(),
      Column.findOne({
        _id: toColumnId,
        boardId: req.params.boardId,
        workspaceId: workspace._id
      }).lean()
    ]);
    if (!fromCol)
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'fromColumnId does not belong to this board' }
      });
    if (!toCol)
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'toColumnId does not belong to this board' }
      });

    if (fromColumnId === toColumnId) {
      // Same-column reorder — re-slot the task and reindex
      const siblings = await Task.find({
        boardId: req.params.boardId,
        workspaceId: workspace._id,
        columnId: fromColumnId,
        _id: { $ne: task._id }
      }).sort({ order: 1 });

      siblings.splice(newOrder - 1, 0, task);
      await Promise.all(
        siblings.map((item, index) => {
          item.order = index + 1;
          return item.save();
        })
      );
    } else {
      // Cross-column move
      const [fromSiblings, toSiblings] = await Promise.all([
        Task.find({
          boardId: req.params.boardId,
          workspaceId: workspace._id,
          columnId: fromColumnId,
          _id: { $ne: task._id }
        }).sort({ order: 1 }),
        Task.find({
          boardId: req.params.boardId,
          workspaceId: workspace._id,
          columnId: toColumnId,
          _id: { $ne: task._id }
        }).sort({ order: 1 })
      ]);

      toSiblings.splice(newOrder - 1, 0, task);
      await Promise.all([
        ...fromSiblings.map((item, index) => {
          item.order = index + 1;
          return item.save();
        }),
        ...toSiblings.map((item, index) => {
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
    io.to(`board:${task.boardId}`).emit('task:moved', {
      taskId: String(task._id),
      fromColumnId,
      toColumnId,
      newOrder,
      updatedTask: await serializeTask(task),
      senderId: req.user.id
    });

    try {
      const user = await User.findById(req.user.id).select('name').lean();
      await logActivity(
        workspace._id,
        req.user.id,
        'task_moved',
        `${user?.name || 'Someone'} moved ${task.title}`,
        {
          taskId: String(task._id),
          fromColumnId,
          toColumnId
        }
      );
    } catch (_) {
      /* non-critical */
    }

    return res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// PATCH /:workspaceId/boards/:boardId/tasks/:taskId
// ---------------------------------------------------------------------------

router.patch(
  '/:workspaceId/boards/:boardId/tasks/:taskId',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId', 'taskId'),
  validate(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const task = await Task.findOne({
      _id: req.params.taskId,
      boardId: req.params.boardId,
      workspaceId: workspace._id
    });
    if (!task)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

    const updates = req.body;
    const prevAssignee = task.assigneeId ? String(task.assigneeId) : null;

    UPDATABLE_TASK_FIELDS.forEach((key) => {
      if (updates[key] !== undefined) task[key] = updates[key];
    });
    task.updatedAt = new Date();
    await task.save();

    const io = req.app.get('io');
    const serializedTask = await serializeTask(task);
    io.to(`board:${task.boardId}`).emit('task:updated', {
      task: serializedTask,
      senderId: req.user.id
    });

    try {
      const newAssignee = task.assigneeId ? String(task.assigneeId) : null;
      if (prevAssignee !== newAssignee && newAssignee) {
        const user = await User.findById(req.user.id).select('name').lean();
        const link = `/workspace/${workspace._id}/boards/${task.boardId}/tasks/${task._id}`;
        await notifyUser(
          newAssignee,
          workspace._id,
          'task_assigned',
          `${user?.name || 'Someone'} assigned you to ${task.title}`,
          link
        );
        await logActivity(
          workspace._id,
          req.user.id,
          'task_assigned',
          `${user?.name || 'Someone'} assigned ${task.title}`,
          {
            taskId: String(task._id),
            assigneeId: newAssignee
          }
        );
      }
    } catch (_) {
      /* non-critical */
    }

    return res.json({ success: true, task: serializedTask });
  })
);

// ---------------------------------------------------------------------------
// DELETE /:workspaceId/boards/:boardId/tasks/:taskId
// ---------------------------------------------------------------------------

router.delete(
  '/:workspaceId/boards/:boardId/tasks/:taskId',
  authMiddleware,
  validateObjectId('workspaceId', 'boardId', 'taskId'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const task = await Task.findOne({
      _id: req.params.taskId,
      boardId: req.params.boardId,
      workspaceId: workspace._id
    });
    if (!task)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

    await Promise.all([
      Task.deleteOne({ _id: task._id }),
      Comment.deleteMany({ taskId: task._id })
    ]);

    const io = req.app.get('io');
    io.to(`board:${task.boardId}`).emit('task:deleted', {
      taskId: String(task._id),
      senderId: req.user.id
    });

    return res.json({ success: true });
  })
);

module.exports = router;
