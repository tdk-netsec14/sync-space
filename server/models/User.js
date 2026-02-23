const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: '#6366f1' },
    createdAt: { type: Date, default: Date.now }
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

module.exports = mongoose.model('User', userSchema);