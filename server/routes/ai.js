const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const validateObjectId = require('../middleware/validateObjectId');
const Board = require('../models/Board');
const Column = require('../models/Column');
const Task = require('../models/Task');
const Member = require('../models/Member');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const {
  generateSprintReport,
  generateStandup,
  suggestAssignee,
  generateTaskDescription
} = require('../services/aiService');

const router = express.Router();

// ---------------------------------------------------------------------------
// In-Memory Cache (10 min TTL)
// ---------------------------------------------------------------------------
const aiCache = new Map();

function getCached(key) {
  const item = aiCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    aiCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data, ttlMs = 10 * 60 * 1000) {
  aiCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureWorkspaceMember(workspaceId, userId) {
  return Promise.all([
    Workspace.findById(workspaceId),
    Member.findOne({ workspaceId, userId })
  ]).then(([workspace, member]) => {
    if (!workspace) return { error: 'Workspace not found' };
    if (!member) return { error: 'Not a member of this workspace' };
    return { workspace, member };
  });
}

function getRateLimiters() {
  const keyGenerator = (req) => {
    if (req.user?.id) return String(req.user.id);
    return ipKeyGenerator(req);
  };

  return [
    rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      handler: (req, res) =>
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: "You've generated a lot recently. Try again in a minute."
          }
        })
    }),
    rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      handler: (req, res) =>
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: "You've reached your hourly AI limit. Try again later."
          }
        })
    })
  ];
}

router.use((req, res, next) => {
  if (process.env.AI_ENABLED === 'false') {
    return res.status(503).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'AI features are currently disabled.' }
    });
  }
  next();
});

router.use(authMiddleware);
router.use(...getRateLimiters());

// ---------------------------------------------------------------------------
// POST /:workspaceId/ai/sprint-report
// ---------------------------------------------------------------------------

router.post(
  '/:workspaceId/ai/sprint-report',
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const { boardId, weekStart, weekEnd } = req.body;
    if (!boardId || !weekStart || !weekEnd) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'boardId, weekStart, and weekEnd are required' }
      });
    }

    const board = await Board.findOne({ _id: boardId, workspaceId: workspace._id });
    if (!board)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Board not found' } });

    const start = new Date(weekStart);
    const end = new Date(weekEnd);

    const cacheKey = `sprint:${workspace._id}:${board._id}:${start.toISOString()}:${end.toISOString()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        report: cached,
        generatedAt: new Date().toISOString(),
        cached: true
      });
    }

    const [columns, tasks, , activityLogs] = await Promise.all([
      Column.find({ boardId: board._id, workspaceId: workspace._id }).sort({ order: 1 }),
      Task.find({ boardId: board._id, workspaceId: workspace._id }).populate(
        'assigneeId',
        'name email avatar'
      ),
      Member.find({ workspaceId: workspace._id }).populate('userId', 'name email avatar'),
      ActivityLog.find({
        workspaceId: workspace._id,
        createdAt: { $gte: start, $lte: end }
      }).populate('userId', 'name email avatar')
    ]);

    const doneColumnIds = columns
      .filter((col) => String(col.name).toLowerCase() === 'done')
      .map((col) => String(col._id));

    let tasksCreated = tasks.filter((t) => t.createdAt >= start && t.createdAt <= end);
    let tasksCompleted = tasks.filter(
      (t) =>
        doneColumnIds.includes(String(t.columnId)) && t.updatedAt >= start && t.updatedAt <= end
    );
    let tasksInProgress = tasks.filter(
      (t) =>
        !doneColumnIds.includes(String(t.columnId)) && t.updatedAt >= start && t.updatedAt <= end
    );

    const totalTasksForAI = tasksCreated.length + tasksCompleted.length + tasksInProgress.length;
    let truncationNote = false;

    if (totalTasksForAI > 100) {
      // Keep mostly completed and in progress
      tasksCompleted = tasksCompleted.slice(0, 40);
      tasksInProgress = tasksInProgress.slice(0, 40);
      tasksCreated = tasksCreated.slice(0, 20);
      truncationNote = true;
    }
    const blockedTasks = tasks
      .filter((t) => t.dueDate && t.dueDate < end && !doneColumnIds.includes(String(t.columnId)))
      .map((t) => ({ title: t.title, assignee: t.assigneeId?.name || 'unassigned' }));

    const memberActivityMap = new Map();
    activityLogs.forEach((activity) => {
      const userId = String(activity.userId?._id || activity.userId || '');
      if (!userId) return;
      const current = memberActivityMap.get(userId) || {
        name: activity.userId?.name || 'Unknown',
        count: 0
      };
      current.count += 1;
      memberActivityMap.set(userId, current);
    });

    const boardData = {
      boardName: board.name,
      columns: columns.map((col) => ({ id: String(col._id), name: col.name })),
      tasksCompleted: tasksCompleted.map((t) => ({ title: t.title })),
      tasksCreated: tasksCreated.map((t) => ({ title: t.title })),
      tasksInProgress: tasksInProgress.map((t) => ({ title: t.title })),
      memberActivity: Array.from(memberActivityMap.values()).sort((a, b) => b.count - a.count),
      blockedTasks,
      truncationNote
    };

    const report = await generateSprintReport(boardData, start.toISOString(), end.toISOString());
    if (!report || report.trim() === '') {
      return res.status(500).json({
        success: false,
        error: {
          code: 'AI_ERROR',
          message: 'Failed to generate sprint report. AI returned empty response.'
        }
      });
    }

    setCached(cacheKey, report);
    return res.json({ success: true, report, generatedAt: new Date().toISOString() });
  })
);

// ---------------------------------------------------------------------------
// POST /:workspaceId/ai/standup
// ---------------------------------------------------------------------------

router.post(
  '/:workspaceId/ai/standup',
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateStr = new Date().toISOString().slice(0, 10);
    const cacheKey = `standup:${workspace._id}:${req.user.id}:${dateStr}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        standup: cached,
        generatedAt: new Date().toISOString(),
        cached: true
      });
    }

    const user = await User.findById(req.user.id).select('name');

    const [activities, completedTasks, assignedTasks, commentedActivities] = await Promise.all([
      ActivityLog.find({
        workspaceId: workspace._id,
        userId: req.user.id,
        createdAt: { $gte: since }
      }).sort({
        createdAt: -1
      }),
      Task.find({
        workspaceId: workspace._id,
        assigneeId: req.user.id,
        updatedAt: { $gte: since }
      }).select('title'),
      Task.find({
        workspaceId: workspace._id,
        assigneeId: req.user.id,
        createdAt: { $gte: since }
      }).select('title'),
      ActivityLog.find({
        workspaceId: workspace._id,
        userId: req.user.id,
        type: 'task_commented',
        createdAt: { $gte: since }
      }).sort({ createdAt: -1 })
    ]);

    const taskIdsFromActivity = [
      ...new Set(
        activities
          .map((a) => a.metadata?.taskId)
          .filter(Boolean)
          .map(String)
      )
    ];
    const commentedTaskIds = [
      ...new Set(
        commentedActivities
          .map((a) => a.metadata?.taskId)
          .filter(Boolean)
          .map(String)
      )
    ];

    const [referencedTasks, commentedTasks] = await Promise.all([
      taskIdsFromActivity.length
        ? Task.find({ workspaceId: workspace._id, _id: { $in: taskIdsFromActivity } }).select(
            'title'
          )
        : Promise.resolve([]),
      commentedTaskIds.length
        ? Task.find({ workspaceId: workspace._id, _id: { $in: commentedTaskIds } }).select('title')
        : Promise.resolve([])
    ]);

    const memberActivity = {
      tasksCompleted: [...new Set(completedTasks.map((t) => t.title))],
      tasksWorkedOn: [...new Set(referencedTasks.map((t) => t.title))],
      tasksAssigned: [...new Set(assignedTasks.map((t) => t.title))],
      commentsPosted: [...new Set(commentedTasks.map((t) => t.title))],
      last24Hours: activities.length
    };

    const standup = await generateStandup(memberActivity, user?.name || 'You');
    if (!standup || standup.trim() === '') {
      return res.status(500).json({
        success: false,
        error: {
          code: 'AI_ERROR',
          message: 'Failed to generate standup. AI returned empty response.'
        }
      });
    }

    setCached(cacheKey, standup);
    return res.json({ success: true, standup, generatedAt: new Date().toISOString() });
  })
);

// ---------------------------------------------------------------------------
// POST /:workspaceId/ai/suggest-assignee
// ---------------------------------------------------------------------------

router.post(
  '/:workspaceId/ai/suggest-assignee',
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const { taskId, title, description, labels } = req.body;
    let task = null;
    if (taskId) {
      task = await Task.findOne({ _id: taskId, workspaceId: workspace._id }).select(
        'title description priority labels'
      );
      if (!task)
        return res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }

    const members = await Member.find({ workspaceId: workspace._id }).populate(
      'userId',
      'name email avatar'
    );
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [counts, activityCounts, completedCounts] = await Promise.all([
      Task.aggregate([
        { $match: { workspaceId: workspace._id, assigneeId: { $ne: null } } },
        { $group: { _id: '$assigneeId', count: { $sum: 1 } } }
      ]),
      ActivityLog.aggregate([
        { $match: { workspaceId: workspace._id, createdAt: { $gte: weekStart } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } }
      ]),
      Task.aggregate([
        { $match: { workspaceId: workspace._id, updatedAt: { $gte: weekStart } } },
        { $group: { _id: '$assigneeId', count: { $sum: 1 } } }
      ])
    ]);

    const countMap = new Map(counts.map((e) => [String(e._id), e.count]));
    const activityMap = new Map(activityCounts.map((e) => [String(e._id), e.count]));
    const completedMap = new Map(completedCounts.map((e) => [String(e._id), e.count]));

    const memberList = members
      .filter((m) => m.userId)
      .map((m) => ({
        id: String(m.userId._id),
        name: m.userId.name,
        currentTaskCount: countMap.get(String(m.userId._id)) || 0,
        recentActivity: activityMap.get(String(m.userId._id)) || 0,
        completedThisWeek: completedMap.get(String(m.userId._id)) || 0
      }));

    const sourceTask = task || { title, description, priority: 'medium', labels: labels || [] };
    const suggestion = await suggestAssignee(sourceTask, memberList);

    return res.json({ success: true, suggestion });
  })
);

// ---------------------------------------------------------------------------
// POST /:workspaceId/ai/task-description
// ---------------------------------------------------------------------------

router.post(
  '/:workspaceId/ai/task-description',
  validateObjectId('workspaceId'),
  asyncHandler(async (req, res) => {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error)
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error } });

    const { taskTitle, boardId } = req.body;
    if (!taskTitle || !boardId) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'taskTitle and boardId are required' }
      });
    }

    const board = await Board.findOne({ _id: boardId, workspaceId: workspace._id });
    if (!board)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'Board not found' } });

    const recentTasks = await Task.find({ boardId: board._id, workspaceId: workspace._id })
      .sort({ updatedAt: -1 })
      .limit(15)
      .select('title');

    const description = await generateTaskDescription(taskTitle, {
      boardName: board.name,
      existingTaskTitles: recentTasks.map((t) => t.title)
    });

    return res.json({ success: true, description });
  })
);

module.exports = router;
