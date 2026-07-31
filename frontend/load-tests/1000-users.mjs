import SockJS from "sockjs-client";
import { performance } from "node:perf_hooks";

const baseUrl = process.env.SRGH_LOAD_BASE_URL || "http://localhost:3021";
const users = Number(process.env.SRGH_LOAD_USERS || 1000);
const restConcurrency = Number(process.env.SRGH_LOAD_REST_CONCURRENCY || 100);
const socketBatchSize = Number(process.env.SRGH_LOAD_SOCKET_BATCH || 100);
const socketBatchDelayMs = Number(process.env.SRGH_LOAD_SOCKET_BATCH_DELAY_MS || 250);
const socketConnectTimeoutMs = Number(process.env.SRGH_LOAD_SOCKET_TIMEOUT_MS || 30000);
const socketHoldMs = Number(process.env.SRGH_LOAD_SOCKET_HOLD_MS || 10000);

const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ employeeNumber: "1001", password: "1234" }),
});
if (!loginResponse.ok) throw new Error(`Login failed: ${loginResponse.status}`);
const { token } = await loginResponse.json();
const headers = { Authorization: `Bearer ${token}` };
const availableRooms = await fetch(`${baseUrl}/api/rooms`, { headers }).then(response => response.json());
const testRoomId = availableRooms[0]?.id;
if (!testRoomId) throw new Error("A chat room is required for the WebSocket fan-out test.");

const percentile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
};
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function runRestVirtualUser() {
  const started = performance.now();
  const responses = await Promise.all([
    fetch(`${baseUrl}/api/auth/me`, { headers }),
    fetch(`${baseUrl}/api/directory/employees`, { headers }),
    fetch(`${baseUrl}/api/rooms`, { headers }),
  ]);
  const ok = responses.every(response => response.ok);
  await Promise.all(responses.map(response => response.arrayBuffer()));
  return { ok, duration: performance.now() - started };
}

const restDurations = [];
let restSuccess = 0;
let restFailure = 0;
const restStarted = performance.now();
for (let offset = 0; offset < users; offset += restConcurrency) {
  const count = Math.min(restConcurrency, users - offset);
  const results = await Promise.all(Array.from({ length: count }, runRestVirtualUser));
  for (const result of results) {
    restDurations.push(result.duration);
    result.ok ? restSuccess++ : restFailure++;
  }
}
const restElapsed = performance.now() - restStarted;

const sockets = [];
const socketDurations = [];
let socketConnected = 0;
let socketFailed = 0;
let fanoutReceived = 0;
let fanoutMessageId;
let fanoutMarker = "";
const socketStarted = performance.now();

function connectSocket(index) {
  return new Promise(resolve => {
    const started = performance.now();
    const socket = new SockJS(`${baseUrl}/ws`, undefined, { transports: ["websocket"] });
    let settled = false;
    const finish = success => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (success) {
        socketConnected++;
        socketDurations.push(performance.now() - started);
        sockets.push(socket);
      } else {
        socketFailed++;
        try { socket.close(); } catch {}
      }
      resolve();
    };
    const timeout = setTimeout(() => finish(false), socketConnectTimeoutMs);
    socket.onopen = () => socket.send("CONNECT\naccept-version:1.2\nheart-beat:0,0\n\n\u0000");
    socket.onmessage = event => {
      const frame = String(event.data);
      if (frame.startsWith("CONNECTED")) {
        socket.send(`SUBSCRIBE\nid:load-${index}\ndestination:/topic/rooms/${testRoomId}\nack:auto\n\n\u0000`);
        finish(true);
      } else if (frame.startsWith("MESSAGE") && fanoutMarker) {
        try {
          const payload = JSON.parse(frame.slice(frame.indexOf("\n\n") + 2).replace(/\u0000$/, ""));
          if (payload.content === fanoutMarker) {
            fanoutReceived++;
            fanoutMessageId ??= payload.id;
          }
        } catch {}
      }
    };
    socket.onerror = () => finish(false);
    socket.onclose = () => {
      if (!settled) finish(false);
    };
  });
}

for (let offset = 0; offset < users; offset += socketBatchSize) {
  const count = Math.min(socketBatchSize, users - offset);
  await Promise.all(Array.from({ length: count }, (_, index) => connectSocket(offset + index)));
  if (offset + count < users) await sleep(socketBatchDelayMs);
}
const socketConnectElapsed = performance.now() - socketStarted;
fanoutMarker = `LOAD_TEST_1000_${Date.now()}`;
const fanoutStarted = performance.now();
sockets[0]?.send(`SEND\ndestination:/app/chat.send\ntoken:${token}\ncontent-type:application/json\n\n${JSON.stringify({ roomId: testRoomId, content: fanoutMarker, type: "TEXT" })}\u0000`);
while (fanoutReceived < socketConnected && performance.now() - fanoutStarted < 10000) {
  await sleep(50);
}
const fanoutElapsed = performance.now() - fanoutStarted;
await sleep(socketHoldMs);
const socketAlive = sockets.filter(socket => socket.readyState === SockJS.OPEN).length;
for (const socket of sockets) {
  try {
    if (socket.readyState === SockJS.OPEN) socket.send("DISCONNECT\nreceipt:close\n\n\u0000");
    socket.close();
  } catch {}
}
if (fanoutMessageId) {
  await fetch(`${baseUrl}/api/rooms/messages/${fanoutMessageId}`, { method: "DELETE", headers });
}

console.log(JSON.stringify({
  configuration: { users, restConcurrency, socketBatchSize, socketHoldMs },
  rest: {
    success: restSuccess,
    failure: restFailure,
    successRate: restSuccess / users,
    elapsedMs: Math.round(restElapsed),
    virtualUsersPerSecond: Number((users / (restElapsed / 1000)).toFixed(2)),
    p50Ms: Math.round(percentile(restDurations, 0.50)),
    p95Ms: Math.round(percentile(restDurations, 0.95)),
    p99Ms: Math.round(percentile(restDurations, 0.99)),
    maxMs: Math.round(Math.max(...restDurations)),
  },
  websocket: {
    connected: socketConnected,
    failed: socketFailed,
    aliveAfterHold: socketAlive,
    connectElapsedMs: Math.round(socketConnectElapsed),
    p50ConnectMs: Math.round(percentile(socketDurations, 0.50)),
    p95ConnectMs: Math.round(percentile(socketDurations, 0.95)),
    p99ConnectMs: Math.round(percentile(socketDurations, 0.99)),
    maxConnectMs: Math.round(Math.max(0, ...socketDurations)),
    fanout: {
      roomId: testRoomId,
      received: fanoutReceived,
      expected: socketConnected,
      successRate: socketConnected ? fanoutReceived / socketConnected : 0,
      elapsedMs: Math.round(fanoutElapsed),
      testMessageDeleted: Boolean(fanoutMessageId),
    },
  },
}, null, 2));
