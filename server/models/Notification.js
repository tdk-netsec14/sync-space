const mongoose = require('mongoose');

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    type: {
      type: String,
      enum: ['task_assigned', 'task_commented', 'member_joined', 'board_created', 'task_due_soon'],
      required: true
    },
    message: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: 'createdAt' } }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Primary: inbox view — user's unread notifications newest-first
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// Unread count query: userId + read only
NotificationSchema.index({ userId: 1, read: 1 });

// Workspace-level cascade deletes
NotificationSchema.index({ workspaceId: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
