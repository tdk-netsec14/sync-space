const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const memberRoutes = require('./routes/members');
const boardRoutes = require('./routes/boards');
const taskRoutes = require('./routes/tasks');
const commentsRoutes = require('./routes/comments');
const notificationsRoutes = require('./routes/notifications');
const activityRoutes = require('./routes/activity');
const aiRoutes = require('./routes/ai');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true
  }
});

app.set('io', io);
// expose io globally for services to emit to user rooms
global.io = io;

function resolveMongoUri() {
  const configured = process.env.MONGODB_URI;

  if (!configured || configured.startsWith('your_')) {
    return 'mongodb://127.0.0.1:27017/syncspace';
  }

  return configured;
}

io.on('connection', (socket) => {
  socket.on('join:workspace', (workspaceId) => {
    socket.join(`workspace:${workspaceId}`);
    console.log(`socket ${socket.id} joined workspace:${workspaceId}`);
  });

  socket.on('join:board', (boardId) => {
    socket.join(`board:${boardId}`);
    console.log(`socket ${socket.id} joined board:${boardId}`);
  });

  socket.on('join:user', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`socket ${socket.id} joined user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`socket ${socket.id} disconnected`);
  });
});

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/workspaces', memberRoutes);
app.use('/api/workspaces', boardRoutes);
app.use('/api/workspaces', taskRoutes);
app.use('/api/workspaces', commentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/workspaces', activityRoutes);
app.use('/api/workspaces', aiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  res.status(500).json({ error: 'Something went wrong' });
});

async function start() {
  try {
    await mongoose.connect(resolveMongoUri());
    httpServer.listen(port, () => {
      console.log(`SyncSpace server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server');
    console.error(error.message);
    process.exit(1);
  }
}

start();