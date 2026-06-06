const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    columnId: { type: mongoose.Schema.Types.ObjectId, ref: 'Column', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // 'critical' added to match Zod enum; 'urgent' kept for backward-compat migration
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical', 'urgent'],
      default: 'medium'
    },
    dueDate: { type: Date, default: null },
    order: { type: Number, required: true },
    labels: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Primary lookup + board view ordering
taskSchema.index({ boardId: 1, columnId: 1, order: 1 });

// Workspace-level queries (stats, deletion cascade)
taskSchema.index({ workspaceId: 1 });

// Assignee queries (notifications, suggestions)
taskSchema.index({ assigneeId: 1 });

// Due-date overdue queries
taskSchema.index({ dueDate: 1 }, { sparse: true });

module.exports = mongoose.model('Task', taskSchema);
