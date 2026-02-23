const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

memberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Member', memberSchema);