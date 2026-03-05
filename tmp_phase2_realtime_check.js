const { io } = require('socket.io-client');

const base = 'http://localhost:5000';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`${res.status} ${JSON.stringify(data)}`);
  }

  return data;
}

(async () => {
  const ts = Date.now();
  console.log('step: register');
  const register = await fetchJson(`${base}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ name: `Phase2 ${ts}`, email: `phase2_${ts}@example.com`, password: 'password123' })
  });

  console.log('step: login');
  const login = await fetchJson(`${base}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: `phase2_${ts}@example.com`, password: 'password123' })
  });

  const headers = { Authorization: `Bearer ${login.token}` };
  console.log('step: workspace');
  const workspace = await fetchJson(`${base}/api/workspaces`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `Workspace ${ts}`, description: 'desc', logo: '🚀', color: '#6366f1' })
  });

  const workspaceId = workspace.workspace._id;
  console.log('step: board');
  const board = await fetchJson(`${base}/api/workspaces/${workspaceId}/boards`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Board A', description: 'Board desc', color: '#0ea5e9' })
  });

  const boardId = board.board.id;
  const backlog = board.columns.find((column) => column.name === 'Backlog');
  const done = board.columns.find((column) => column.name === 'Done');

  console.log('step: socket connect');
  const socket = io(base, { transports: ['websocket'] });
  await new Promise((resolve) => socket.on('connect', resolve));
  socket.emit('join:workspace', workspaceId);
  socket.emit('join:board', boardId);

  const createdPromise = new Promise((resolve) => socket.on('task:created', resolve));
  const movedPromise = new Promise((resolve) => socket.on('task:moved', resolve));

  console.log('step: create task');
  const createdTask = await fetchJson(`${base}/api/workspaces/${workspaceId}/boards/${boardId}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Task 1', columnId: backlog.id })
  });

  const createdEvent = await Promise.race([
    createdPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('created timeout')), 8000))
  ]);

  console.log('step: reorder');
  const moved = await fetchJson(`${base}/api/workspaces/${workspaceId}/boards/${boardId}/tasks/reorder`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      taskId: createdTask.task.id,
      fromColumnId: backlog.id,
      toColumnId: done.id,
      newOrder: 1
    })
  });

  const movedEvent = await Promise.race([
    movedPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('moved timeout')), 8000))
  ]);

  console.log(JSON.stringify({
    register: !!register.token,
    workspaceId,
    boardId,
    createdEvent: Boolean(createdEvent.task),
    movedEvent: Boolean(movedEvent.updatedTask),
    moved: moved.success === true
  }, null, 2));

  socket.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
