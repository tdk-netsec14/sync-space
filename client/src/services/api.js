import axios from 'axios';

const tokenKey = 'syncspace_token';
const userKey = 'syncspace_user';
const workspaceKey = 'syncspace_workspace';

export const api = axios.create({
  baseURL: 'http://localhost:5000'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(tokenKey);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(userKey);
      localStorage.removeItem(workspaceKey);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const storageKeys = {
  tokenKey,
  userKey,
  workspaceKey
};

export function registerUser(payload, inviteToken) {
  return api.post(`/api/auth/register${inviteToken ? `?inviteToken=${inviteToken}` : ''}`, payload);
}

export function loginUser(payload, inviteToken) {
  return api.post(`/api/auth/login${inviteToken ? `?inviteToken=${inviteToken}` : ''}`, payload);
}

export function fetchMe() {
  return api.get('/api/auth/me');
}

export function fetchWorkspaces() {
  return api.get('/api/workspaces');
}

export function createWorkspace(payload) {
  return api.post('/api/workspaces', payload);
}

export function getWorkspace(workspaceId) {
  return api.get(`/api/workspaces/${workspaceId}`);
}

export function updateWorkspace(workspaceId, payload) {
  return api.patch(`/api/workspaces/${workspaceId}`, payload);
}

export function deleteWorkspace(workspaceId) {
  return api.delete(`/api/workspaces/${workspaceId}`);
}

export function fetchWorkspaceBoards(workspaceId) {
  return api.get(`/api/workspaces/${workspaceId}/boards`);
}

export function createInvite(workspaceId, payload) {
  return api.post(`/api/workspaces/${workspaceId}/invite`, payload);
}

export function getInviteInfo(token) {
  return api.get(`/api/workspaces/join/${token}`);
}

export function joinInvite(workspaceToken) {
  return api.post(`/api/workspaces/join/${workspaceToken}`);
}

export function fetchMembers(workspaceId) {
  return api.get(`/api/workspaces/${workspaceId}/members`);
}

export function updateMemberRole(workspaceId, userId, payload) {
  return api.patch(`/api/workspaces/${workspaceId}/members/${userId}`, payload);
}

export function removeMember(workspaceId, userId) {
  return api.delete(`/api/workspaces/${workspaceId}/members/${userId}`);
}

export function leaveWorkspace(workspaceId) {
  return api.delete(`/api/workspaces/${workspaceId}/leave`);
}

export function fetchWorkspaceStats(workspaceId) {
  return api.get(`/api/workspaces/${workspaceId}/stats`);
}

export function fetchWorkspaceActivity(workspaceId, params = {}) {
  return api.get(`/api/workspaces/${workspaceId}/activity`, { params });
}

export function fetchTaskComments(workspaceId, taskId) {
  return api.get(`/api/workspaces/${workspaceId}/tasks/${taskId}/comments`);
}

export function createTaskComment(workspaceId, taskId, payload) {
  return api.post(`/api/workspaces/${workspaceId}/tasks/${taskId}/comments`, payload);
}

export function updateTaskComment(workspaceId, taskId, commentId, payload) {
  return api.patch(`/api/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`, payload);
}

export function deleteTaskComment(workspaceId, taskId, commentId) {
  return api.delete(`/api/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`);
}

export function fetchNotifications() {
  return api.get('/api/notifications');
}

export function fetchUnreadNotificationCount() {
  return api.get('/api/notifications/unread-count');
}

export function markNotificationRead(notificationId) {
  return api.patch(`/api/notifications/${notificationId}/read`);
}

export function markAllNotificationsRead() {
  return api.patch('/api/notifications/read-all');
}

export function updateProfile(payload) {
  return api.patch('/api/auth/me', payload);
}

export function changePassword(payload) {
  return api.patch('/api/auth/me/password', payload);
}

export function generateSprintReport(workspaceId, payload) {
  return api.post(`/api/workspaces/${workspaceId}/ai/sprint-report`, payload);
}

export function generateStandup(workspaceId) {
  return api.post(`/api/workspaces/${workspaceId}/ai/standup`);
}

export function suggestAssignee(workspaceId, payload) {
  return api.post(`/api/workspaces/${workspaceId}/ai/suggest-assignee`, payload);
}

export function generateTaskDescription(workspaceId, payload) {
  return api.post(`/api/workspaces/${workspaceId}/ai/task-description`, payload);
}