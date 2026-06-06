const mongoose = require('mongoose');

const { Schema } = mongoose;

const ActivityLogSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: 'createdAt' } }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Primary: workspace feed sorted by newest-first (covers pagination)
ActivityLogSchema.index({ workspaceId: 1, createdAt: -1 });

// Per-user queries (standup generation)
ActivityLogSchema.index({ workspaceId: 1, userId: 1, createdAt: -1 });

// Type-filtered queries (e.g. all 'task_commented' in a workspace)
ActivityLogSchema.index({ workspaceId: 1, type: 1, createdAt: -1 });

// TTL: MongoDB will auto-delete documents older than 90 days.
// This is a safety net; the cron job handles bulk archival proactively.
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
