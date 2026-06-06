const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: '#6366f1' },
    createdAt: { type: Date, default: Date.now },

    // Account lockout
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false }
  },
  { versionKey: false }
);

userSchema.pre('save', async function save(next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }

    if (!this.password.startsWith('$2')) {
      this.password = await bcrypt.hash(this.password, 10);
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Returns true if the account is currently locked.
 */
userSchema.methods.isLocked = function isLocked() {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

/**
 * Increments failed login attempts. Locks the account for LOCK_DURATION_MS
 * once MAX_LOGIN_ATTEMPTS is reached.
 */
userSchema.methods.incrementLoginAttempts = async function incrementLoginAttempts() {
  // If a previous lock has expired, reset the counter first
  if (this.lockUntil && this.lockUntil.getTime() <= Date.now()) {
    return this.model('User').updateOne(
      { _id: this._id },
      { $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } }
    );
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock on reaching the threshold
  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION_MS) };
  }

  return this.model('User').updateOne({ _id: this._id }, updates);
};

/**
 * Clears failed login attempts and removes any active lock on successful login.
 */
userSchema.methods.resetLoginAttempts = async function resetLoginAttempts() {
  return this.model('User').updateOne(
    { _id: this._id },
    { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } }
  );
};

module.exports = mongoose.model('User', userSchema);
