const { io } = require('socket.io-client');

const [workspaceId, boardId] = process.argv.slice(2);
const socket = io('http://localhost:5000', { transports: ['websocket'] });
const received = { created: false, moved: false };

function maybeFinish() {
  if (received.created && received.moved) {
    console.log(JSON.stringify(received, null, 2));
    socket.disconnect();
    process.exit(0);
  }
}

socket.on('connect', () => {
  socket.emit('join:workspace', workspaceId);
  socket.emit('join:board', boardId);
  console.log('listener-ready');
});

socket.on('task:created', (payload) => {
  received.created = Boolean(payload && payload.task);
  console.log('task:created');
  maybeFinish();
});

socket.on('task:moved', (payload) => {
  received.moved = Boolean(payload && payload.updatedTask);
  console.log('task:moved');
  maybeFinish();
});

setTimeout(() => {
  console.log(JSON.stringify(received, null, 2));
  socket.disconnect();
  process.exit(received.created && received.moved ? 0 : 1);
}, 15000);
