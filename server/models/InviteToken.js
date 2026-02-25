const mongoose = require('mongoose');

const inviteTokenSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    token: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { versionKey: false }
);

module.exports = mongoose.model('InviteToken', inviteTokenSchema);