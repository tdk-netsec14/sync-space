const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#6366f1' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Primary: list all boards in a workspace sorted by creation date
boardSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Board', boardSchema);
