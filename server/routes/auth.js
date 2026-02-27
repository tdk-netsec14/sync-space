const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Member = require('../models/Member');
const Workspace = require('../models/Workspace');
const InviteToken = require('../models/InviteToken');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

function createToken(user) {
  return jwt.sign({ id: user._id.toString(), name: user.name, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').toLowerCase());
}

function avatarColor(seed) {
  let hash = 0;
  const value = String(seed || 'syncspace');
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }
  const color = (hash >>> 0).toString(16).slice(-6).padStart(6, '0');
  return `#${color}`;
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar
  };
}

async function consumeInviteToken(inviteTokenValue, userId) {
  const invite = await InviteToken.findOne({ token: inviteTokenValue }).populate('workspaceId');

  if (!invite) {
    return { error: 'invalid' };
  }

  const now = new Date();

  if (invite.usedAt) {
    return { error: 'used' };
  }

  if (invite.expiresAt.getTime() <= now.getTime()) {
    return { error: 'expired' };
  }

  const member = await Member.create({
    workspaceId: invite.workspaceId._id,
    userId,
    role: invite.role
  });

  invite.usedAt = now;
  invite.usedBy = userId;
  await invite.save();

  return { invite, member };
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const inviteTokenValue = req.query.inviteToken;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() });

    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (inviteTokenValue) {
      const invite = await InviteToken.findOne({ token: inviteTokenValue });

      if (!invite) {
        return res.status(400).json({ error: 'Invalid invite token' });
      }

      if (invite.usedAt) {
        return res.status(400).json({ error: 'Invite token already used' });
      }

      if (invite.expiresAt.getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Invite token expired' });
      }
    }

    const user = await User.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password,
      avatar: avatarColor(email)
    });

    if (inviteTokenValue) {
      const inviteResult = await consumeInviteToken(inviteTokenValue, user._id);

      if (inviteResult.error) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ error: `Invite token ${inviteResult.error}` });
      }
    }

    const token = createToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'Already exists' });
    }

    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const inviteTokenValue = req.query.inviteToken;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (inviteTokenValue) {
      const invite = await InviteToken.findOne({ token: inviteTokenValue });

      if (!invite) {
        return res.status(400).json({ error: 'Invalid invite token' });
      }

      if (invite.usedAt) {
        return res.status(400).json({ error: 'Invite token already used' });
      }

      if (invite.expiresAt.getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Invite token expired' });
      }
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (inviteTokenValue) {
      const invite = await InviteToken.findOne({ token: inviteTokenValue });
      if (invite) {
        const existingMember = await Member.findOne({ workspaceId: invite.workspaceId, userId: user._id });
        if (!existingMember) {
          const inviteResult = await consumeInviteToken(inviteTokenValue, user._id);
          if (inviteResult.error) {
            return res.status(400).json({ error: `Invite token ${inviteResult.error}` });
          }
        }
      }
    }

    const token = createToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const memberships = await Member.find({ userId: user._id }).populate('workspaceId');

    return res.json({
      user: serializeUser(user),
      memberships: memberships
        .filter((membership) => membership.workspaceId)
        .map((membership) => ({
          id: membership._id,
          role: membership.role,
          workspace: {
            id: membership.workspaceId._id,
            name: membership.workspaceId.name,
            slug: membership.workspaceId.slug,
            description: membership.workspaceId.description,
            logo: membership.workspaceId.logo,
            color: membership.workspaceId.color,
            ownerId: membership.workspaceId.ownerId,
            createdAt: membership.workspaceId.createdAt
          }
        }))
    });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, avatar } = req.body;

    if (name !== undefined) {
      const nextName = String(name).trim();
      if (!nextName) {
        return res.status(400).json({ error: 'Name is required' });
      }
      user.name = nextName;
    }

    if (avatar !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(avatar))) {
        return res.status(400).json({ error: 'Invalid avatar color' });
      }
      user.avatar = String(avatar);
    }

    await user.save();

    const token = createToken(user);

    return res.json({ token, user: serializeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/me/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (String(newPassword) !== String(confirmPassword)) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatches = await bcrypt.compare(String(currentPassword), user.password);
    if (!passwordMatches) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    user.password = String(newPassword);
    await user.save();

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;