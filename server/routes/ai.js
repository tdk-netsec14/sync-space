const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const authMiddleware = require('../middleware/authMiddleware');
const Board = require('../models/Board');
const Column = require('../models/Column');
const Task = require('../models/Task');
const Member = require('../models/Member');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { generateSprintReport, generateStandup, suggestAssignee, generateTaskDescription } = require('../services/aiService');

const router = express.Router();

function ensureWorkspaceMember(workspaceId, userId) {
  return Promise.all([Workspace.findById(workspaceId), Member.findOne({ workspaceId, userId })]).then(([workspace, member]) => {
    if (!workspace) return { error: 'Workspace not found' };
    if (!member) return { error: 'Not a member of this workspace' };
    return { workspace, member };
  });
}

function getRateLimiters() {
  const keyGenerator = (req) => {
    // Use authenticated user ID if available; otherwise fallback to proper IP handling for IPv4/IPv6
    if (req.user?.id) return String(req.user.id);
    // ipKeyGenerator returns a normalized string representation for IPv4 and IPv6 addresses
    return ipKeyGenerator(req);
  };

  return [
    rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      handler: (req, res) => res.status(429).json({ error: "You've generated a lot recently. Try again in a minute." })
    }),
    rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      handler: (req, res) => res.status(429).json({ error: "You've generated a lot recently. Try again in a minute." })
    })
  ];
}

router.use(authMiddleware);
router.use(...getRateLimiters());

router.post('/:workspaceId/ai/sprint-report', async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) return res.status(403).json({ error });

    const { boardId, weekStart, weekEnd } = req.body;
    if (!boardId || !weekStart || !weekEnd) {
      return res.status(400).json({ error: 'boardId, weekStart, and weekEnd are required' });
    }

    const board = await Board.findOne({ _id: boardId, workspaceId: workspace._id });
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const start = new Date(weekStart);
    const end = new Date(weekEnd);

    const [columns, tasks, memberDocs, activityLogs] = await Promise.all([
      Column.find({ boardId: board._id, workspaceId: workspace._id }).sort({ order: 1 }),
      Task.find({ boardId: board._id, workspaceId: workspace._id }).populate('assigneeId', 'name email avatar'),
      Member.find({ workspaceId: workspace._id }).populate('userId', 'name email avatar'),
      ActivityLog.find({ workspaceId: workspace._id, createdAt: { $gte: start, $lte: end } }).populate('userId', 'name email avatar')
    ]);

    const doneColumnIds = columns.filter((column) => String(column.name).toLowerCase() === 'done').map((column) => String(column._id));
    const tasksCreated = tasks.filter((task) => task.createdAt >= start && task.createdAt <= end);
    const tasksCompleted = tasks.filter((task) => doneColumnIds.includes(String(task.columnId)) && task.updatedAt >= start && task.updatedAt <= end);
    const tasksInProgress = tasks.filter((task) => !doneColumnIds.includes(String(task.columnId)) && task.updatedAt >= start && task.updatedAt <= end);
    const blockedTasks = tasks
      .filter((task) => task.dueDate && task.dueDate < end && !doneColumnIds.includes(String(task.columnId)))
      .map((task) => ({
        title: task.title,
        assignee: task.assigneeId?.name || 'unassigned'
      }));

    const memberActivityMap = new Map();
    activityLogs.forEach((activity) => {
      const userId = String(activity.userId?._id || activity.userId || '');
      if (!userId) return;
      const current = memberActivityMap.get(userId) || { name: activity.userId?.name || 'Unknown', count: 0 };
      current.count += 1;
      memberActivityMap.set(userId, current);
    });

    const boardData = {
      boardName: board.name,
      columns: columns.map((column) => ({ id: String(column._id), name: column.name })),
      tasksCompleted: tasksCompleted.map((task) => ({ title: task.title })),
      tasksCreated: tasksCreated.map((task) => ({ title: task.title })),
      tasksInProgress: tasksInProgress.map((task) => ({ title: task.title })),
      memberActivity: Array.from(memberActivityMap.values()).sort((left, right) => right.count - left.count),
      blockedTasks
    };

    const report = await generateSprintReport(boardData, start.toISOString(), end.toISOString());

    return res.json({ report, generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
});

router.post('/:workspaceId/ai/standup', async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) return res.status(403).json({ error });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const user = await User.findById(req.user.id).select('name');
    const [activities, completedTasks, assignedTasks, commentedActivities] = await Promise.all([
      ActivityLog.find({ workspaceId: workspace._id, userId: req.user.id, createdAt: { $gte: since } }).sort({ createdAt: -1 }),
      Task.find({ workspaceId: workspace._id, assigneeId: req.user.id, updatedAt: { $gte: since } }).select('title'),
      Task.find({ workspaceId: workspace._id, assigneeId: req.user.id, createdAt: { $gte: since } }).select('title'),
      ActivityLog.find({ workspaceId: workspace._id, userId: req.user.id, type: 'task_commented', createdAt: { $gte: since } }).sort({ createdAt: -1 })
    ]);

    const taskIdsFromActivity = [...new Set(activities.map((activity) => activity.metadata?.taskId).filter(Boolean).map((taskId) => String(taskId)))];
    const commentedTaskIds = [...new Set(commentedActivities.map((activity) => activity.metadata?.taskId).filter(Boolean).map((taskId) => String(taskId)))];
    const referencedTasks = taskIdsFromActivity.length
      ? await Task.find({ workspaceId: workspace._id, _id: { $in: taskIdsFromActivity } }).select('title')
      : [];
    const commentedTasks = commentedTaskIds.length
      ? await Task.find({ workspaceId: workspace._id, _id: { $in: commentedTaskIds } }).select('title')
      : [];

    const memberActivity = {
      tasksCompleted: [...new Set(completedTasks.map((task) => task.title))],
      tasksWorkedOn: [...new Set(referencedTasks.map((task) => task.title))],
      tasksAssigned: [...new Set(assignedTasks.map((task) => task.title))],
      commentsPosted: [...new Set(commentedTasks.map((task) => task.title))],
      last24Hours: activities.length
    };

    const standup = await generateStandup(memberActivity, user?.name || 'You');
    return res.json({ standup, generatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
});

router.post('/:workspaceId/ai/suggest-assignee', async (req, res) => {
  try {
    const { workspace, member, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) return res.status(403).json({ error });



    const { taskId, title, description, labels } = req.body;
    let task = null;
    if (taskId) {
      task = await Task.findOne({ _id: taskId, workspaceId: workspace._id }).select('title description priority labels');
      if (!task) return res.status(404).json({ error: 'Task not found' });
    }

    const members = await Member.find({ workspaceId: workspace._id }).populate('userId', 'name email avatar');
    const counts = await Task.aggregate([
      { $match: { workspaceId: workspace._id, assigneeId: { $ne: null } } },
      { $group: { _id: '$assigneeId', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map((entry) => [String(entry._id), entry.count]));

    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activityCounts = await ActivityLog.aggregate([
      { $match: { workspaceId: workspace._id, createdAt: { $gte: weekStart } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);
    const activityMap = new Map(activityCounts.map((entry) => [String(entry._id), entry.count]));

    const completedCounts = await Task.aggregate([
      { $match: { workspaceId: workspace._id, updatedAt: { $gte: weekStart } } },
      { $group: { _id: '$assigneeId', count: { $sum: 1 } } }
    ]);
    const completedMap = new Map(completedCounts.map((entry) => [String(entry._id), entry.count]));

    const memberList = members
      .filter((member) => member.userId)
      .map((member) => ({
        id: String(member.userId._id),
        name: member.userId.name,
        currentTaskCount: countMap.get(String(member.userId._id)) || 0,
        recentActivity: activityMap.get(String(member.userId._id)) || 0,
        completedThisWeek: completedMap.get(String(member.userId._id)) || 0
      }));

    const sourceTask = task || { title, description, priority: 'medium', labels: labels || [] };
    const suggestion = await suggestAssignee(sourceTask, memberList);

    return res.json({ suggestion });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
});

router.post('/:workspaceId/ai/task-description', async (req, res) => {
  try {
    const { workspace, error } = await ensureWorkspaceMember(req.params.workspaceId, req.user.id);
    if (error) return res.status(403).json({ error });

    const { taskTitle, boardId } = req.body;
    if (!taskTitle || !boardId) {
      return res.status(400).json({ error: 'taskTitle and boardId are required' });
    }

    const board = await Board.findOne({ _id: boardId, workspaceId: workspace._id });
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const recentTasks = await Task.find({ boardId: board._id, workspaceId: workspace._id }).sort({ updatedAt: -1 }).limit(15).select('title');
    const description = await generateTaskDescription(taskTitle, {
      boardName: board.name,
      existingTaskTitles: recentTasks.map((task) => task.title)
    });

    return res.json({ description });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
});

module.exports = router;