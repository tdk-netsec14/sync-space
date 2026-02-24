const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema(
  {
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    color: { type: String, default: '#e2e8f0' },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

columnSchema.index({ boardId: 1 });

module.exports = mongoose.model('Column', columnSchema);