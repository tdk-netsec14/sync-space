/**
 * client/src/context/SocketContext.jsx
 *
 * Provides a Socket.IO client connection with:
 *  1. JWT auth on the handshake (read by server's io.use() middleware)
 *  2. Exponential-backoff reconnection (10 attempts, 1s→60s)
 *  3. Room tracking refs — joinedWorkspaces / joinedBoards — for accurate rejoins
 *  4. Auto-rejoin on 'connect' event (fires on first connect AND every reconnect)
 *  5. Application-level heartbeat — client emits 'ping' every 20s; if N
 *     consecutive pongs are missed the socket is manually disconnected &
 *     will reconnect via Socket.IO's built-in mechanism
 *  6. Presence state — exposes onlineUsers: Map<workspaceId, Set<userId>>
 *     updated by 'presence:update' events from the server
 *  7. All event listeners registered in useEffect with cleanup to prevent duplicates
 *  8. Only opens a connection when the user is authenticated
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { tokenKey } from '../services/api';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const HEARTBEAT_INTERVAL = 20_000; // emit 'ping' every 20 seconds
const HEARTBEAT_MAX_MISS = 3; // force-disconnect after 3 missed pongs

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const SocketContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Map()); // Map<workspaceId, Set<userId>>
  const { isAuthenticated, token } = useAuth();

  // Track active rooms so we can accurately rejoin on reconnect
  const joinedWorkspaces = useRef(new Set());
  const joinedBoards = useRef(new Set());

  // Heartbeat state — stored in refs so interval callback reads latest values
  const heartbeatTimer = useRef(null);
  const missedPongs = useRef(0);

  // ---------------------------------------------------------------------------
  // Stable room-management helpers exposed via context
  // ---------------------------------------------------------------------------
  const joinWorkspace = useCallback((workspaceId) => {
    if (!workspaceId) return;
    setSocket((s) => {
      if (s?.connected) {
        s.emit('join:workspace', workspaceId);
        joinedWorkspaces.current.add(workspaceId);
      }
      return s;
    });
  }, []);

  const joinBoard = useCallback((boardId) => {
    if (!boardId) return;
    setSocket((s) => {
      if (s?.connected) {
        s.emit('join:board', boardId);
        joinedBoards.current.add(boardId);
      }
      return s;
    });
  }, []);

  const leaveBoard = useCallback((boardId) => {
    joinedBoards.current.delete(boardId);
  }, []);

  // ---------------------------------------------------------------------------
  // Heartbeat helpers
  // ---------------------------------------------------------------------------
  function startHeartbeat(s) {
    stopHeartbeat();
    missedPongs.current = 0;

    heartbeatTimer.current = setInterval(() => {
      if (!s.connected) return;

      missedPongs.current += 1;
      if (missedPongs.current > HEARTBEAT_MAX_MISS) {
        console.warn('[Socket] Heartbeat timeout — forcing reconnect');
        stopHeartbeat();
        s.disconnect();
        s.connect(); // Socket.IO will re-authenticate and rejoin rooms
        return;
      }

      s.emit('ping');
    }, HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const accessToken = token || localStorage.getItem(tokenKey) || '';

    const nextSocket = io(SOCKET_URL, {
      withCredentials: true,

      // JWT sent on handshake — required by server's io.use() auth middleware
      auth: { token: accessToken },

      // ---------------------------------------------------------------------------
      // Exponential-backoff reconnection
      //   attempt 1 → 1 000ms
      //   attempt 2 → 2 000ms
      //   attempt 3 → 4 000ms
      //   …
      //   attempt 7+ → 60 000ms (capped)
      // ---------------------------------------------------------------------------
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 60_000,
      randomizationFactor: 0.5, // ±50% jitter to spread storm reconnects

      // Transport: try WebSocket first, fall back to polling
      transports: ['websocket', 'polling']
    });

    // -------------------------------------------------------------------------
    // on connect (fires on first connect AND every successful reconnect)
    // Re-join all previously active rooms
    // -------------------------------------------------------------------------
    function onConnect() {
      const workspaceIds = [...joinedWorkspaces.current];
      const boardIds = [...joinedBoards.current];

      if (workspaceIds.length || boardIds.length) {
        nextSocket.emit('rejoin:rooms', { workspaceIds, boardIds });
      }

      startHeartbeat(nextSocket);
    }

    // -------------------------------------------------------------------------
    // on pong — heartbeat reply from server
    // -------------------------------------------------------------------------
    function onPong() {
      missedPongs.current = 0; // Reset miss counter on any pong received
    }

    // -------------------------------------------------------------------------
    // on presence:update — server broadcasts online member list for a workspace
    // -------------------------------------------------------------------------
    function onPresenceUpdate({ workspaceId, onlineUserIds }) {
      if (!workspaceId) return;
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(workspaceId, new Set(onlineUserIds));
        return next;
      });
    }

    // -------------------------------------------------------------------------
    // on user:offline — a member in a workspace went offline
    // -------------------------------------------------------------------------
    function onUserOffline({ userId, workspaceId }) {
      if (!workspaceId || !userId) return;
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        const members = new Set(prev.get(workspaceId));
        members.delete(userId);
        next.set(workspaceId, members);
        return next;
      });
    }

    // -------------------------------------------------------------------------
    // on disconnect
    // -------------------------------------------------------------------------
    function onDisconnect(reason) {
      console.warn('[Socket] Disconnected:', reason);
      stopHeartbeat();
    }

    // -------------------------------------------------------------------------
    // on connect_error
    // -------------------------------------------------------------------------
    function onConnectError(err) {
      console.warn('[Socket] Connection error:', err.message);
    }

    // Register all listeners — once, here; cleaned up in return fn below
    nextSocket.on('connect', onConnect);
    nextSocket.on('pong', onPong);
    nextSocket.on('presence:update', onPresenceUpdate);
    nextSocket.on('user:offline', onUserOffline);
    nextSocket.on('disconnect', onDisconnect);
    nextSocket.on('connect_error', onConnectError);

    setSocket(nextSocket);

    // -------------------------------------------------------------------------
    // Cleanup — runs on unmount or when auth state changes
    // Removes ALL listeners before disconnecting to prevent duplicates
    // -------------------------------------------------------------------------
    return () => {
      stopHeartbeat();

      // Remove every listener registered above (prevents duplicate listeners
      // if the effect re-runs before the old socket fully disconnects)
      nextSocket.off('connect', onConnect);
      nextSocket.off('pong', onPong);
      nextSocket.off('presence:update', onPresenceUpdate);
      nextSocket.off('user:offline', onUserOffline);
      nextSocket.off('disconnect', onDisconnect);
      nextSocket.off('connect_error', onConnectError);

      nextSocket.disconnect();
      joinedWorkspaces.current.clear();
      joinedBoards.current.clear();
      setOnlineUsers(new Map());
    };
  }, [isAuthenticated, token]); // Re-run only when auth state or token changes

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------
  const value = {
    socket,
    onlineUsers, // Map<workspaceId, Set<userId>>
    joinWorkspace,
    joinBoard,
    leaveBoard
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Returns the full socket context. */
export const useSocket = () => useContext(SocketContext);

/**
 * Returns the Set of online userIds for a specific workspace.
 * Returns an empty Set if no data yet.
 *
 * @param {string} workspaceId
 * @returns {Set<string>}
 */
export function usePresence(workspaceId) {
  const ctx = useContext(SocketContext);
  if (!ctx || !workspaceId) return new Set();
  return ctx.onlineUsers?.get(workspaceId) ?? new Set();
}
