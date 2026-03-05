(async () => {
  const base = 'http://localhost:5000/api';
  const email = `test+${Date.now()}@example.com`;
  const password = 'password123';
  const name = 'Tmp Tester';

  function out(obj) { console.log(JSON.stringify(obj, null, 2)); }

  try {
    let res = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`register failed: ${res.status} ${JSON.stringify(body)}`);
    }

    const register = await res.json();
    const token = register.token;

    // create workspace
    res = await fetch(`${base}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Tmp Workspace' })
    });

    if (!res.ok) throw new Error(`workspace create failed: ${res.status}`);
    const ws = await res.json();
    const workspaceId = ws.workspace._id || ws.workspace.id || ws.workspaceId || (ws.workspace && ws.workspace._id);

    // create board
    res = await fetch(`${base}/workspaces/${workspaceId}/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Tmp Board' })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`board create failed: ${res.status} ${JSON.stringify(body)}`);
    }

    const boardRes = await res.json();
    const boardId = boardRes.board.id || boardRes.board._id;
    const columns = boardRes.columns || [];
    const backlogId = columns[0]?.id || columns[0]?._id || null;
    const doneId = columns[3]?.id || columns[3]?._id || null;

    out({ token, workspaceId, boardId, backlogId, doneId, email });
  } catch (err) {
    console.error('setup error', err.message);
    process.exit(1);
  }
})();
