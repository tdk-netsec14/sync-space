const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Converts a raw invite token string to its SHA-256 hex hash.
 * Only the hash is stored in the database; the raw token lives in the invite URL only.
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

const inviteTokenSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },
    // Store only the SHA-256 hash of the raw token — never the plaintext
    tokenHash: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { versionKey: false }
);

/**
 * Looks up an invite document by the raw (unhashed) token string.
 */
inviteTokenSchema.statics.findByRawToken = function findByRawToken(rawToken) {
  return this.findOne({ tokenHash: hashToken(rawToken) });
};

/**
 * Creates a new invite token document. Generates a cryptographically random
 * raw token, stores only its hash, and returns both the document and the raw
 * token so the caller can embed it in the invite URL.
 *
 * @param {object} data - Fields to pass to InviteToken.create() (minus tokenHash)
 * @returns {{ rawToken: string, doc: InviteTokenDocument }}
 */
inviteTokenSchema.statics.createWithToken = async function createWithToken(data) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const doc = await this.create({ ...data, tokenHash });
  return { rawToken, doc };
};

module.exports = mongoose.model('InviteToken', inviteTokenSchema);
