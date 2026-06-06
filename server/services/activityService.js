const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const User = require('../models/User');

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id,
    name: user.name,
    avatar: user.avatar
  };
}

/**
 * Logs a single activity event within a workspace and emits a realtime socket event.
 *
 * @param {string} workspaceId - The ID of the workspace where the event occurred.
 * @param {string} userId - The ID of the user performing the action.
 * @param {string} type - The specific action type (e.g., 'task_created').
 * @param {string} description - Human-readable description of the activity.
 * @param {Object} [metadata={}] - Optional metadata regarding the event.
 * @returns {Promise<Object>} The saved ActivityLog document.
 */
async function logActivity(workspaceId, userId, type, description, metadata = {}) {
  const activity = await ActivityLog.create({ workspaceId, userId, type, description, metadata });

  try {
    const io = global.io;
    if (io) {
      const user = await User.findById(userId).select('name avatar');
      io.to('workspace:' + String(workspaceId)).emit('activity:new', {
        activity: {
          id: activity._id,
          workspaceId: activity.workspaceId,
          user: serializeUser(user),
          type: activity.type,
          description: activity.description,
          metadata: activity.metadata,
          createdAt: activity.createdAt
        }
      });
    }
  } catch (err) {
    // Activity logging must not fail if realtime emission does.
    // eslint-disable-next-line no-console
    console.error('logActivity emit failed', err && err.message);
  }

  return activity;
}

/**
 * Creates an in-app notification for a user and emits a realtime socket event.
 *
 * @param {string} userId - The target user receiving the notification.
 * @param {string} workspaceId - The relevant workspace ID.
 * @param {string} type - The notification type (e.g., 'mention').
 * @param {string} message - Human-readable message content.
 * @param {string} [link=''] - Optional URL or route to navigate to on click.
 * @returns {Promise<Object>} The saved Notification document.
 */
async function notifyUser(userId, workspaceId, type, message, link = '') {
  const notification = await Notification.create({ userId, workspaceId, type, message, link, read: false });
  const payload = {
    id: notification._id,
    userId: notification.userId,
    workspaceId: notification.workspaceId,
    type: notification.type,
    message: notification.message,
    link: notification.link,
    read: notification.read,
    createdAt: notification.createdAt
  };

  try {
    const io = global.io;
    if (io) {
      io.to('user:' + String(userId)).emit('notification:new', { notification: payload });
    }
  } catch (err) {
    // Log but don't fail
    // eslint-disable-next-line no-console
    console.error('notifyUser emit failed', err && err.message);
  }

  return notification;
}

module.exports = { logActivity, notifyUser };
