(async () => {
  const [token, workspaceId, boardId, backlogId, doneId] = process.argv.slice(2);
  const base = 'http://localhost:5000/api';

  if (!token || !workspaceId || !boardId || !backlogId || !doneId) {
    console.error('Usage: node tmp_phase2_actions.js <token> <workspaceId> <boardId> <backlogId> <doneId>');
    process.exit(1);
  }

  try {
    // create task
    let res = await fetch(`${base}/workspaces/${workspaceId}/boards/${boardId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'Realtime Task', columnId: backlogId })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`create task failed: ${res.status} ${JSON.stringify(body)}`);
    }

    const taskRes = await res.json();
    console.log('created', taskRes);
    const taskId = taskRes.task.id || taskRes.task._id;

    // reorder to done
    res = await fetch(`${base}/workspaces/${workspaceId}/boards/${boardId}/tasks/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ taskId, fromColumnId: backlogId, toColumnId: doneId, newOrder: 1 })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`reorder failed: ${res.status} ${JSON.stringify(body)}`);
    }

    const reorderRes = await res.json();
    console.log('reorder', reorderRes);
    process.exit(0);
  } catch (err) {
    console.error('actions error', err.message);
    process.exit(1);
  }
})();
