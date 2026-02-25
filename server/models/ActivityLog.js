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

ActivityLogSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
