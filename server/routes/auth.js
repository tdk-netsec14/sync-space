const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const User = require('../models/User');
const Member = require('../models/Member');
const InviteToken = require('../models/InviteToken');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { generateCsrfToken, doubleCsrfProtection } = require('../middleware/security');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers — IP extraction
// ---------------------------------------------------------------------------

function getIP(req) {
  return (
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const STRONG_PASSWORD = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    'Password must contain at least one special character'
  );

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  password: STRONG_PASSWORD
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long').optional(),
    avatar: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid avatar color')
      .optional()
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: STRONG_PASSWORD,
    confirmPassword: z.string().min(1, 'Confirm password is required')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const REFRESH_COOKIE = 'syncspace_refresh';
const REFRESH_EXPIRY_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

function getRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    // Must be 'none' in production because frontend and backend are on
    // different domains. 'none' requires secure:true (HTTPS).
    sameSite: isProduction ? 'none' : 'strict',
    maxAge: REFRESH_EXPIRY_MS,
    path: '/'
  };
}

function clearRefreshCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/'
  });
}

// ---------------------------------------------------------------------------
// Token creation
// ---------------------------------------------------------------------------

function createAccessToken(user) {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  return jwt.sign({ id: user._id.toString(), name: user.name, email: user.email }, secret, {
    expiresIn: '3d'
  });
}

function createRefreshToken(user) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  return jwt.sign({ id: user._id.toString() }, secret, { expiresIn: '10d' });
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function avatarColor(seed) {
  let hash = 0;
  const value = String(seed || 'syncspace');
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `#${(hash >>> 0).toString(16).slice(-6).padStart(6, '0')}`;
}

function serializeUser(user) {
  return { id: user._id, name: user.name, email: user.email, avatar: user.avatar };
}

async function consumeInviteToken(rawToken, userId) {
  const invite = await InviteToken.findByRawToken(rawToken).populate('workspaceId');
  if (!invite) return { error: 'invalid' };
  const now = new Date();
  if (invite.usedAt) return { error: 'used' };
  if (invite.expiresAt.getTime() <= now.getTime()) return { error: 'expired' };

  await Member.create({ workspaceId: invite.workspaceId._id, userId, role: invite.role });
  invite.usedAt = now;
  invite.usedBy = userId;
  await invite.save();
  return { invite };
}

// ---------------------------------------------------------------------------
// CSRF token endpoint — must come BEFORE doubleCsrfProtection
// ---------------------------------------------------------------------------

router.get('/csrf-token', (req, res) => {
  const token = generateCsrfToken(req, res);
  return res.json({ csrfToken: token });
});

// Apply CSRF to all mutating routes below
router.use(doubleCsrfProtection);

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const inviteTokenValue = req.query.inviteToken;
    const ip = getIP(req);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('Registration failed — email already exists', { ip, email });
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Email already registered' }
      });
    }

    if (inviteTokenValue) {
      const invite = await InviteToken.findByRawToken(inviteTokenValue);
      if (!invite)
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid invite token' }
        });
      if (invite.usedAt)
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invite token already used' }
        });
      if (invite.expiresAt.getTime() <= Date.now())
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invite token expired' }
        });
    }

    const user = await User.create({ name, email, password, avatar: avatarColor(email) });

    // Always create a personal workspace for every new user
    let invitedWorkspaceId = null;
    try {
      const Workspace = require('../models/Workspace');

      const baseName = `${name}'s Workspace`;
      const baseSlug = baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'my-workspace';

      let slug = baseSlug;
      let suffix = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const conflict = await Workspace.findOne({ slug });
        if (!conflict) break;
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      const defaultWorkspace = await Workspace.create({
        name: baseName,
        slug,
        description: 'My personal workspace',
        logo: '💼',
        color: '#8B5CF6',
        ownerId: user._id
      });

      await Member.create({
        workspaceId: defaultWorkspace._id,
        userId: user._id,
        role: 'owner'
      });
    } catch (wsErr) {
      logger.warn('Auto workspace creation failed', { userId: user._id, err: wsErr.message });
    }

    // If an invite token was provided, also join the invited workspace
    if (inviteTokenValue) {
      const inviteResult = await consumeInviteToken(inviteTokenValue, user._id);
      if (inviteResult.error) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: `Invite token ${inviteResult.error}` }
        });
      }
      // Capture the workspace ID so the frontend can navigate there
      invitedWorkspaceId = String(inviteResult.invite.workspaceId._id || inviteResult.invite.workspaceId);
    }



    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    res.cookie(REFRESH_COOKIE, refreshToken, getRefreshCookieOptions());

    logger.info('User registered', { userId: user._id, ip });

    return res.status(201).json({
      success: true,
      token: accessToken,
      user: serializeUser(user),
      invitedWorkspaceId: invitedWorkspaceId || null
    });

  })
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const inviteTokenValue = req.query.inviteToken;
    const ip = getIP(req);

    if (inviteTokenValue) {
      const invite = await InviteToken.findByRawToken(inviteTokenValue);
      if (!invite)
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid invite token' }
        });
      if (invite.usedAt)
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invite token already used' }
        });
      if (invite.expiresAt.getTime() <= Date.now())
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invite token expired' }
        });
    }

    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

    if (!user) {
      logger.warn('Login failed — user not found', { ip, email });
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' }
      });
    }

    // Account lockout check
    if (user.isLocked()) {
      const waitMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      logger.warn('Login blocked — account locked', { ip, userId: user._id });
      return res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account temporarily locked. Try again in ${waitMinutes} minute${waitMinutes !== 1 ? 's' : ''}.`
        }
      });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password);

    if (!passwordMatches) {
      await user.incrementLoginAttempts();
      const attemptsLeft = Math.max(0, 5 - (user.loginAttempts + 1));
      const locked = attemptsLeft === 0;
      logger.warn('Login failed — wrong password', { ip, userId: user._id, attemptsLeft, locked });
      const message = locked
        ? 'Invalid email or password. Account is now locked for 15 minutes.'
        : `Invalid email or password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before lockout.`;
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message } });
    }

    await user.resetLoginAttempts();

    let loginInvitedWorkspaceId = null;
    if (inviteTokenValue) {
      const invite = await InviteToken.findByRawToken(inviteTokenValue);
      if (invite) {
        const existingMember = await Member.findOne({
          workspaceId: invite.workspaceId,
          userId: user._id
        });
        if (!existingMember) {
          const inviteResult = await consumeInviteToken(inviteTokenValue, user._id);
          if (inviteResult.error) {
            return res.status(400).json({
              success: false,
              error: { code: 'BAD_REQUEST', message: `Invite token ${inviteResult.error}` }
            });
          }
          loginInvitedWorkspaceId = String(
            inviteResult.invite.workspaceId._id || inviteResult.invite.workspaceId
          );
        } else {
          // Already a member — still navigate them to that workspace
          loginInvitedWorkspaceId = String(invite.workspaceId);
        }
      }
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    res.cookie(REFRESH_COOKIE, refreshToken, getRefreshCookieOptions());

    logger.info('Login successful', { userId: user._id, ip });

    return res.json({
      success: true,
      token: accessToken,
      user: serializeUser(user),
      invitedWorkspaceId: loginInvitedWorkspaceId || null
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const ip = getIP(req);
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE];

    if (!rawRefreshToken) {
      logger.warn('Token refresh failed — no cookie', { ip });
      return res
        .status(401)
        .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No refresh token' } });
    }

    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const payload = jwt.verify(rawRefreshToken, secret); // throws on invalid/expired

    const user = await User.findById(payload.id);
    if (!user) {
      clearRefreshCookie(res);
      logger.warn('Token refresh failed — user not found', { ip, userId: payload.id });
      return res
        .status(401)
        .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    }

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);
    res.cookie(REFRESH_COOKIE, newRefreshToken, getRefreshCookieOptions());

    logger.info('Token refreshed', { userId: user._id, ip });

    return res.json({ success: true, token: newAccessToken, user: serializeUser(user) });
  })
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

router.post('/logout', (req, res) => {
  const ip = getIP(req);
  const userId = req.user?.id || null;
  clearRefreshCookie(res);
  logger.info('User logged out', { userId, ip });
  return res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

    const memberships = await Member.find({ userId: user._id }).populate('workspaceId');

    return res.json({
      success: true,
      user: serializeUser(user),
      memberships: memberships
        .filter((m) => m.workspaceId)
        .map((m) => ({
          id: m._id,
          role: m.role,
          workspace: {
            id: m.workspaceId._id,
            name: m.workspaceId.name,
            slug: m.workspaceId.slug,
            description: m.workspaceId.description,
            logo: m.workspaceId.logo,
            color: m.workspaceId.color,
            ownerId: m.workspaceId.ownerId,
            createdAt: m.workspaceId.createdAt
          }
        }))
    });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/auth/me
// ---------------------------------------------------------------------------

router.patch(
  '/me',
  authMiddleware,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

    const { name, avatar } = req.body;
    if (name !== undefined) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    await user.save();

    const accessToken = createAccessToken(user);
    return res.json({ success: true, token: accessToken, user: serializeUser(user) });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/auth/me/password
// ---------------------------------------------------------------------------

router.patch(
  '/me/password',
  authMiddleware,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const ip = getIP(req);

    const user = await User.findById(req.user.id).select('+password');
    if (!user)
      return res
        .status(404)
        .json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

    const passwordMatches = await bcrypt.compare(String(currentPassword), user.password);
    if (!passwordMatches) {
      logger.warn('Password change failed — wrong current password', { userId: user._id, ip });
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Current password is incorrect' }
      });
    }

    user.password = String(newPassword);
    await user.save();

    logger.info('Password changed', { userId: user._id, ip });
    return res.json({ success: true });
  })
);

module.exports = router;
