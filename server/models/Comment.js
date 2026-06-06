const mongoose = require('mongoose');

const { Schema } = mongoose;

const CommentSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 2000 }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Primary: task comment thread sorted chronologically
CommentSchema.index({ taskId: 1, createdAt: 1 });

// Board-level deletion cascade
CommentSchema.index({ boardId: 1 });

// Workspace-level deletion cascade
CommentSchema.index({ workspaceId: 1 });

module.exports = mongoose.model('Comment', CommentSchema);
