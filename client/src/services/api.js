/**
 * client/src/services/api.js
 *
 * Centralized Axios instance with:
 *  - Base URL from import.meta.env.VITE_API_URL (no hardcoded localhost)
 *  - Request interceptor: attaches Authorization header
 *  - Response interceptor:
 *      • 401 TOKEN_EXPIRED → attempts silent token refresh, retries once
 *      • 401 UNAUTHORIZED (non-expired) → clears session + redirects to login
 *      • Network errors → dispatches a toast event for the global toast handler
 */
import axios from 'axios';

// ---------------------------------------------------------------------------
// Config from env
// ---------------------------------------------------------------------------
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_PREFIX = import.meta.env.VITE_API_PREFIX || '/api/v1';

export const tokenKey = 'syncspace_token';
export const userKey = 'syncspace_user';
export const workspaceKey = 'syncspace_workspace';

// Legacy export for backward compat with AuthContext
export const storageKeys = { tokenKey, userKey, workspaceKey };

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // required for refresh-token cookie
  headers: { 'Content-Type': 'application/json' }
});

// ---------------------------------------------------------------------------
// CSRF token — lazily fetched and cached in memory
// ---------------------------------------------------------------------------
let csrfToken = null;
let csrfFetchPromise = null;

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;
  // Deduplicate concurrent fetches
  if (!csrfFetchPromise) {
    csrfFetchPromise = axios
      .get(`${BASE_URL}${API_PREFIX}/auth/csrf-token`, { withCredentials: true })
      .then((res) => {
        csrfToken = res.data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfFetchPromise = null;
      });
  }
  return csrfFetchPromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getToken() {
  return localStorage.getItem(tokenKey) || '';
}

function clearSession() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  localStorage.removeItem(workspaceKey);
}

function dispatchNetworkToast(message) {
  window.dispatchEvent(new CustomEvent('syncspace:toast', { detail: { message, type: 'error' } }));
}

// ---------------------------------------------------------------------------
// Refresh token logic (called at most once per 401 to avoid infinite loops)
// ---------------------------------------------------------------------------
let isRefreshing = false;
let pendingQueue = []; // Array of { resolve, reject }

function processQueue(error, token = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

async function refreshAccessToken() {
  const response = await axios.post(
    `${BASE_URL}${API_PREFIX}/auth/refresh`,
    {},
    { withCredentials: true }
  );
  // Server returns { token: '...' } — not { accessToken: '...' }
  const newToken = response.data.token || response.data.accessToken;
  if (!newToken) throw new Error('No token returned from refresh endpoint');
  localStorage.setItem(tokenKey, newToken);
  return newToken;
}

// ---------------------------------------------------------------------------
// Request interceptor — attach Authorization + CSRF headers
// ---------------------------------------------------------------------------
api.interceptors.request.use(async (config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Attach CSRF token to all mutating requests
  if (MUTATING_METHODS.has(config.method?.toLowerCase())) {
    try {
      const csrf = await ensureCsrfToken();
      if (csrf) config.headers['x-csrf-token'] = csrf;
    } catch {
      // Non-fatal — server will reject with 403 if token is truly required
    }
  }

  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 (refresh / logout) + network errors
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Network error (no response) — show toast
    if (!error.response) {
      dispatchNetworkToast('Network error — please check your connection.');
      return Promise.reject(error);
    }

    const { status, data } = error.response;
    const code = data?.error?.code;

    // -----------------------------------------------------------------------
    // 403 CSRF failure — clear cached token, fetch a fresh one, retry once
    // -----------------------------------------------------------------------
    if (status === 403 && !originalRequest._csrfRetried) {
      originalRequest._csrfRetried = true;
      csrfToken = null; // invalidate stale token
      try {
        const freshCsrf = await ensureCsrfToken();
        originalRequest.headers['x-csrf-token'] = freshCsrf;
        return api(originalRequest);
      } catch {
        // Fall through to normal rejection
      }
    }

    // -----------------------------------------------------------------------
    // 401 TOKEN_EXPIRED — attempt silent refresh (once per request)
    // -----------------------------------------------------------------------
    if (status === 401 && code === 'TOKEN_EXPIRED' && !originalRequest._retried) {
      originalRequest._retried = true;

      if (isRefreshing) {
        // Queue this request until the ongoing refresh completes
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(Promise.reject);
      }

      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearSession();
        if (window.location.pathname !== '/login') window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // -----------------------------------------------------------------------
    // 401 UNAUTHORIZED — session is invalid; clear and redirect
    // -----------------------------------------------------------------------
    if (status === 401 && !originalRequest._retried) {
      clearSession();
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// API function library — all paths use API_PREFIX for versioning
// ---------------------------------------------------------------------------

const p = (path) => `${API_PREFIX}${path}`;

// Auth
export const registerUser = (payload, inviteToken) =>
  api.post(`${p('/auth/register')}${inviteToken ? `?inviteToken=${inviteToken}` : ''}`, payload);
export const loginUser = (payload, inviteToken) =>
  api.post(`${p('/auth/login')}${inviteToken ? `?inviteToken=${inviteToken}` : ''}`, payload);
export const fetchMe = () => api.get(p('/auth/me'));
export const refreshToken = () => api.post(p('/auth/refresh'));
export const logoutUser = () => api.post(p('/auth/logout'));
export const fetchCsrfToken = () => api.get(p('/auth/csrf-token'));

// Profile
export const updateProfile = (payload) => api.patch(p('/auth/me'), payload);
export const changePassword = (payload) => api.patch(p('/auth/me/password'), payload);

// Workspaces
export const fetchWorkspaces = () => api.get(p('/workspaces'));
export const createWorkspace = (payload) => api.post(p('/workspaces'), payload);
export const getWorkspace = (workspaceId) => api.get(p(`/workspaces/${workspaceId}`));
export const updateWorkspace = (workspaceId, payload) =>
  api.patch(p(`/workspaces/${workspaceId}`), payload);
export const deleteWorkspace = (workspaceId) => api.delete(p(`/workspaces/${workspaceId}`));
export const fetchWorkspaceStats = (workspaceId) => api.get(p(`/workspaces/${workspaceId}/stats`));
export const fetchWorkspaceActivity = (workspaceId, params = {}) =>
  api.get(p(`/workspaces/${workspaceId}/activity`), { params });

// Invite
export const createInvite = (workspaceId, payload) =>
  api.post(p(`/workspaces/${workspaceId}/invite`), payload);
export const getInviteInfo = (token) => api.get(p(`/workspaces/join/${token}`));
export const joinInvite = (workspaceToken) => api.post(p(`/workspaces/join/${workspaceToken}`));

// Members
export const fetchMembers = (workspaceId) => api.get(p(`/workspaces/${workspaceId}/members`));
export const updateMemberRole = (workspaceId, userId, payload) =>
  api.patch(p(`/workspaces/${workspaceId}/members/${userId}`), payload);
export const removeMember = (workspaceId, userId) =>
  api.delete(p(`/workspaces/${workspaceId}/members/${userId}`));
export const leaveWorkspace = (workspaceId) => api.delete(p(`/workspaces/${workspaceId}/leave`));

// Boards
export const fetchWorkspaceBoards = (workspaceId) =>
  api.get(p(`/workspaces/${workspaceId}/boards`));
export const createBoard = (workspaceId, payload) =>
  api.post(p(`/workspaces/${workspaceId}/boards`), payload);
export const getBoard = (workspaceId, boardId) =>
  api.get(p(`/workspaces/${workspaceId}/boards/${boardId}`));
export const updateBoard = (workspaceId, boardId, payload) =>
  api.patch(p(`/workspaces/${workspaceId}/boards/${boardId}`), payload);
export const deleteBoard = (workspaceId, boardId) =>
  api.delete(p(`/workspaces/${workspaceId}/boards/${boardId}`));

// Tasks — these are accessed via the board endpoint
export const createTask = (workspaceId, boardId, payload) =>
  api.post(p(`/workspaces/${workspaceId}/boards/${boardId}/tasks`), payload);
export const updateTask = (workspaceId, boardId, taskId, payload) =>
  api.patch(p(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`), payload);
export const deleteTask = (workspaceId, boardId, taskId) =>
  api.delete(p(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`));
export const reorderTask = (workspaceId, boardId, payload) =>
  api.patch(p(`/workspaces/${workspaceId}/boards/${boardId}/tasks/reorder`), payload);

// Comments
export const fetchTaskComments = (workspaceId, taskId) =>
  api.get(p(`/workspaces/${workspaceId}/tasks/${taskId}/comments`));
export const createTaskComment = (workspaceId, taskId, payload) =>
  api.post(p(`/workspaces/${workspaceId}/tasks/${taskId}/comments`), payload);
export const updateTaskComment = (workspaceId, taskId, commentId, payload) =>
  api.patch(p(`/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`), payload);
export const deleteTaskComment = (workspaceId, taskId, commentId) =>
  api.delete(p(`/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`));

// Notifications
export const fetchNotifications = () => api.get(p('/notifications'));
export const fetchUnreadNotificationCount = () => api.get(p('/notifications/unread-count'));
export const markNotificationRead = (notificationId) =>
  api.patch(p(`/notifications/${notificationId}/read`));
export const markAllNotificationsRead = () => api.patch(p('/notifications/read-all'));

// AI
export const generateSprintReport = (workspaceId, payload) =>
  api.post(p(`/workspaces/${workspaceId}/ai/sprint-report`), payload);
export const generateStandup = (workspaceId) =>
  api.post(p(`/workspaces/${workspaceId}/ai/standup`), {});
export const suggestAssignee = (workspaceId, payload) =>
  api.post(p(`/workspaces/${workspaceId}/ai/suggest-assignee`), payload);
export const generateTaskDescription = (workspaceId, payload) =>
  api.post(p(`/workspaces/${workspaceId}/ai/task-description`), payload);
