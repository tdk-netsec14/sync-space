/**
 * server/socket/socketHandler.js
 *
 * Centralised Socket.IO connection handler.
 *
 * Features:
 *  1. JWT authentication already done in io.use() before this runs.
 *     socket.user is guaranteed to be set when this handler fires.
 *
 *  2. Presence tracking — one Map per workspace:
 *       presenceMap: workspaceId → Set<userId>
 *     On join:workspace  → add userId, emit presence:update to the room.
 *     On disconnect      → remove from all tracked rooms, emit presence:update.
 *
 *  3. Room cleanup on disconnect — automatically leaves all Socket.IO rooms
 *     and emits user:offline to every workspace the user was part of.
 *
 *  4. Heartbeat / ping-pong — client emits 'ping', server replies 'pong'
 *     with a server timestamp. Stale connections that stop pinging are
 *     detected by Socket.IO's built-in pingTimeout (configured in index.js).
 *
 *  5. Reconnection rejoin — client emits rejoin:rooms after reconnect;
 *     server re-joins rooms and emits rooms:rejoined acknowledgement.
 *
 *  6. No duplicate event listeners — all listeners are registered once
 *     inside the connection handler's closure.
 */

const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Module-level presence state
//   presenceMap: Map<workspaceId:string, Set<userId:string>>
// This lives at the module level so it persists across connections.
// ---------------------------------------------------------------------------
const presenceMap = new Map();

/**
 * Add a user to the presence set for a workspace and broadcast the update.
 *
 * @param {import('socket.io').Server} io
 * @param {string} workspaceId
 * @param {string} userId
 */
function addPresence(io, workspaceId, userId) {
  if (!workspaceId || !userId) return;

  if (!presenceMap.has(workspaceId)) {
    presenceMap.set(workspaceId, new Set());
  }
  presenceMap.get(workspaceId).add(userId);

  io.to(`workspace:${workspaceId}`).emit('presence:update', {
    workspaceId,
    onlineUserIds: [...presenceMap.get(workspaceId)]
  });
}

/**
 * Remove a user from the presence set for a workspace and broadcast the update.
 * Cleans up the workspace entry if the set becomes empty.
 *
 * @param {import('socket.io').Server} io
 * @param {string} workspaceId
 * @param {string} userId
 */
function removePresence(io, workspaceId, userId) {
  if (!presenceMap.has(workspaceId)) return;

  const members = presenceMap.get(workspaceId);
  members.delete(userId);

  if (members.size === 0) {
    presenceMap.delete(workspaceId);
  }

  io.to(`workspace:${workspaceId}`).emit('presence:update', {
    workspaceId,
    onlineUserIds: members.size ? [...members] : []
  });
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

/**
 * Register all per-socket event listeners.
 * Called once per authenticated connection.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerSocketHandlers(io, socket) {
  const userId = socket.user.id;
  const userName = socket.user.name || 'Unknown';

  // Track which workspace rooms THIS socket has joined (for disconnect cleanup)
  const joinedWorkspaceIds = new Set();

  logger.info('Socket connected', {
    socketId: socket.id,
    userId,
    userName,
    transport: socket.conn.transport.name
  });

  // -------------------------------------------------------------------------
  // Auto-join personal notification room
  // -------------------------------------------------------------------------
  socket.join(`user:${userId}`);

  // -------------------------------------------------------------------------
  // join:workspace
  // -------------------------------------------------------------------------
  socket.on('join:workspace', (workspaceId) => {
    if (!workspaceId || typeof workspaceId !== 'string') return;

    const sanitizedId = workspaceId.trim();
    socket.join(`workspace:${sanitizedId}`);
    joinedWorkspaceIds.add(sanitizedId);

    addPresence(io, sanitizedId, userId);

    logger.debug('Socket joined workspace', {
      socketId: socket.id,
      workspaceId: sanitizedId,
      userId
    });
  });

  // -------------------------------------------------------------------------
  // join:board
  // -------------------------------------------------------------------------
  socket.on('join:board', (boardId) => {
    if (!boardId || typeof boardId !== 'string') return;

    const sanitizedId = boardId.trim();
    socket.join(`board:${sanitizedId}`);

    logger.debug('Socket joined board', {
      socketId: socket.id,
      boardId: sanitizedId,
      userId
    });
  });

  // -------------------------------------------------------------------------
  // rejoin:rooms — emitted by client after successful reconnection.
  // Re-subscribes to all previously active rooms and refreshes presence.
  // -------------------------------------------------------------------------
  socket.on('rejoin:rooms', ({ workspaceIds = [], boardIds = [] } = {}) => {
    const safeWorkspaceIds = workspaceIds.filter((id) => typeof id === 'string' && id.trim());
    const safeBoardIds = boardIds.filter((id) => typeof id === 'string' && id.trim());

    safeWorkspaceIds.forEach((id) => {
      socket.join(`workspace:${id}`);
      joinedWorkspaceIds.add(id);
      addPresence(io, id, userId);
    });

    safeBoardIds.forEach((id) => socket.join(`board:${id}`));

    logger.debug('Socket rejoined rooms', {
      socketId: socket.id,
      userId,
      workspaceIds: safeWorkspaceIds,
      boardIds: safeBoardIds
    });

    // Acknowledge so the client knows the rejoin succeeded
    socket.emit('rooms:rejoined', {
      workspaceIds: safeWorkspaceIds,
      boardIds: safeBoardIds
    });
  });

  // -------------------------------------------------------------------------
  // ping / pong — heartbeat mechanism.
  // Client emits 'ping' on its own heartbeat interval.
  // Server replies immediately with 'pong' + server timestamp.
  // If the client misses N pongs it can force-disconnect and reconnect.
  // Socket.IO's own pingTimeout handles truly stale TCP connections.
  // -------------------------------------------------------------------------
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // -------------------------------------------------------------------------
  // disconnect — room cleanup + presence removal + user:offline broadcast
  // -------------------------------------------------------------------------
  socket.on('disconnect', (reason) => {
    logger.info('Socket disconnected', {
      socketId: socket.id,
      userId,
      userName,
      reason
    });

    // Remove from all joined workspace presence maps and broadcast offline status
    for (const workspaceId of joinedWorkspaceIds) {
      removePresence(io, workspaceId, userId);

      // Emit user:offline to workspace room (separate from presence:update)
      // so clients can show a "went offline" indicator or toast
      io.to(`workspace:${workspaceId}`).emit('user:offline', {
        userId,
        userName,
        workspaceId,
        timestamp: new Date().toISOString()
      });
    }

    // Socket.IO automatically removes the socket from all rooms on disconnect;
    // the joinedWorkspaceIds set is per-socket and GC'd with this closure.
    joinedWorkspaceIds.clear();
  });
}

module.exports = { registerSocketHandlers, presenceMap };
