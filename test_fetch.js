const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMGI2NjIxM2ExMWZmNjE0M2MxMjk4NSIsIm5hbWUiOiJUbXAgVGVzdGVyIiwiZW1haWwiOiJ0ZXN0KzE3NzkxMzE5MzczMjFAZXhhbXBsZS5jb20iLCJpYXQiOjE3NzkxMzE5MzcsImV4cCI6MTc3OTczNjczN30.TczRRGxvGRQNVFHJM04WKd5-ciuQ_LUgYtlMgii3naY';
const workspaceId = '6a0b66213a11ff6143c1298a';
const boardId = '6a0b66223a11ff6143c12991';

async function run() {
  try {
    const res = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/boards/${boardId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Status:', res.status);
    const body = await res.json();
    console.log('Body:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
