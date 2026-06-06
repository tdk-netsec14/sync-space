const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const memberRoutes = require('./routes/members');
const boardRoutes = require('./routes/boards');
const taskRoutes = require('./routes/tasks');
const commentsRoutes = require('./routes/comments');
const notificationsRoutes = require('./routes/notifications');
const activityRoutes = require('./routes/activity');
const aiRoutes = require('./routes/ai');

const { applySecurityMiddleware, authLimiter } = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');
const requireJson = require('./middleware/requireJson');
const logger = require('./utils/logger');
const { startScheduler } = require('./services/scheduler');
const { registerSocketHandlers } = require('./socket/socketHandler');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Configurable body size (default 1MB, can override via REQUEST_BODY_LIMIT env)
const BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '1mb';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (!isProduction) return callback(null, true);
    return callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true
};

app.use(cors(corsOptions));

// ---------------------------------------------------------------------------
// Socket.IO — with JWT authentication on handshake
// ---------------------------------------------------------------------------

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: isProduction ? allowedOrigins : true, credentials: true },

  // ---------------------------------------------------------------------------
  // Heartbeat / stale-connection detection
  //   pingInterval: how often (ms) the server sends a ping to the client
  //   pingTimeout:  how long (ms) to wait for a pong before declaring the
  //                 socket dead and emitting 'disconnect'
  // Together these ensure zombie sockets are cleaned up within ~50s.
  // ---------------------------------------------------------------------------
  pingInterval: 25000, // Server pings client every 25 seconds
  pingTimeout: 20000, // Client has 20 seconds to reply before disconnect

  // Limit reconnection data size to avoid amplification on reconnect storms
  maxHttpBufferSize: 1e6 // 1 MB
});

// Auth middleware for Socket.IO — validates JWT on every connection attempt.
// Unauthenticated sockets are rejected before any room join.
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return next(new Error('UNAUTHORIZED: Missing socket auth token'));
    }

    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    const payload = jwt.verify(token, secret);
    // Attach the authenticated user to the socket for downstream use
    socket.user = { id: payload.id, name: payload.name, email: payload.email };
    return next();
  } catch (error) {
    const msg =
      error?.name === 'TokenExpiredError'
        ? 'TOKEN_EXPIRED: Socket auth token expired'
        : 'UNAUTHORIZED: Invalid socket auth token';
    return next(new Error(msg));
  }
});

app.set('io', io);
global.io = io;

// ---------------------------------------------------------------------------
// Security middleware (helmet, mongoSanitize, hpp, rate limiting, cookies)
// ---------------------------------------------------------------------------

applySecurityMiddleware(app);

// ---------------------------------------------------------------------------
// Request logging (Morgan → Winston)
// ---------------------------------------------------------------------------

app.use(
  morgan(isProduction ? 'combined' : 'dev', {
    stream: logger.stream,
    skip: (req) => isProduction && req.url.endsWith('/health')
  })
);

// ---------------------------------------------------------------------------
// Body parsing & Content-Type enforcement
// ---------------------------------------------------------------------------

app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// Enforce Content-Type: application/json on all mutating requests
app.use(requireJson);

// ---------------------------------------------------------------------------
// Socket.IO connection handler — delegates to dedicated module
// ---------------------------------------------------------------------------

io.on('connection', (socket) => registerSocketHandlers(io, socket));

// ---------------------------------------------------------------------------
// Health check — standardized format with dbState + timestamp
// Accessible at BOTH /api/health (legacy) and /api/v1/health
// ---------------------------------------------------------------------------

async function healthHandler(req, res) {
  const dbState = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const dbStatus = dbStates[dbState] || 'unknown';
  const dbOk = dbState === 1;

  let dbLatencyMs = null;
  if (dbOk) {
    const t = Date.now();
    try {
      await mongoose.connection.db.admin().ping();
      dbLatencyMs = Date.now() - t;
    } catch (_) {
      // ping failed — report degraded
    }
  }

  const status = dbOk ? 'ok' : 'degraded';
  const httpStatus = dbOk ? 200 : 503;

  return res.status(httpStatus).json({
    status,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    dbState: dbStatus,
    db: { status: dbStatus, latencyMs: dbLatencyMs }
  });
}

// Mount health at legacy path + versioned path
app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// ---------------------------------------------------------------------------
// Routes — all under /api/v1 prefix + legacy /api aliases for zero downtime
// ---------------------------------------------------------------------------

// Helper to mount both versioned and legacy paths simultaneously
function mountRoute(path, ...handlers) {
  app.use(`/api/v1/${path}`, ...handlers);
  app.use(`/api/${path}`, ...handlers); // Legacy alias — keeps old clients working
}

mountRoute('auth', authLimiter, authRoutes);
mountRoute('workspaces', workspaceRoutes);
mountRoute('workspaces', memberRoutes);
mountRoute('workspaces', boardRoutes);
mountRoute('workspaces', taskRoutes);
mountRoute('workspaces', commentsRoutes);
mountRoute('notifications', notificationsRoutes);
mountRoute('workspaces', activityRoutes);
mountRoute('workspaces', aiRoutes);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` }
  });
});

// ---------------------------------------------------------------------------
// Centralized error handler — MUST be last
// ---------------------------------------------------------------------------

app.use(errorHandler);

// ---------------------------------------------------------------------------
// Process-level crash safety
// ---------------------------------------------------------------------------

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise rejection — shutting down', {
    reason: reason instanceof Error ? reason.stack : String(reason)
  });
  setTimeout(() => process.exit(1), 500);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception — shutting down', { err: error.stack || error.message });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — closing HTTP server');
  // Close Socket.IO first to drain active connections gracefully
  io.close(() => {
    logger.info('Socket.IO server closed');
  });
  httpServer.close(() => {
    logger.info('HTTP server closed. Exiting.');
    mongoose.connection.close(false, () => process.exit(0));
  });
});

// ---------------------------------------------------------------------------
// MongoDB connection with exponential backoff retry
// ---------------------------------------------------------------------------

function resolveMongoUri() {
  const configured = process.env.MONGODB_URI;
  if (!configured || configured.startsWith('your_')) {
    return 'mongodb://127.0.0.1:27017/syncspace';
  }
  return configured;
}

/**
 * Connects to MongoDB with exponential backoff.
 * Attempts: 1, 2, 4, 8, 16, 32 … seconds (capped at 60s).
 * Gives up after MAX_RETRIES consecutive failures.
 */
async function connectWithRetry(uri, options, attempt = 1) {
  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 60000;

  try {
    await mongoose.connect(uri, options);
    const maskedUri = uri.replace(/:\/\/.*@/, '://***@');
    logger.info('MongoDB connected', { uri: maskedUri, attempt });
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      logger.error('MongoDB connection failed after max retries — exiting', {
        attempts: attempt,
        err: error.message
      });
      process.exit(1);
    }

    const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
    logger.warn('MongoDB connection failed — retrying', {
      attempt,
      nextRetryMs: delay,
      err: error.message
    });
    await new Promise((resolve) => setTimeout(resolve, delay));
    return connectWithRetry(uri, options, attempt + 1);
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function start() {
  const mongoUri = resolveMongoUri();

  const mongoOptions = {
    maxPoolSize: 10, // Maximum connections in the pool
    minPoolSize: 2, // Keep at least 2 connections warm
    serverSelectionTimeoutMS: 10000, // Fail fast if no server found
    socketTimeoutMS: 45000, // Close idle sockets after 45s
    connectTimeoutMS: 10000, // Initial connection timeout
    heartbeatFrequencyMS: 10000 // How often to check server health
  };

  await connectWithRetry(mongoUri, mongoOptions);

  // Start background cron jobs after DB is confirmed ready
  startScheduler();

  httpServer.listen(port, () => {
    logger.info('SyncSpace server started', {
      port,
      env: process.env.NODE_ENV || 'development',
      url: `http://localhost:${port}`,
      apiVersion: 'v1',
      bodyLimit: BODY_LIMIT
    });
  });
}

start();
