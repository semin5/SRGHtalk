import { performance } from "node:perf_hooks";
import os from "node:os";

const baseUrl = process.env.SRGH_LOAD_BASE_URL || "http://192.168.205.119:3021";
const users = Number(process.env.SRGH_LOAD_USERS || 10000);
const durationMs = Number(process.env.SRGH_LOAD_DURATION_MS || 600000);
const restPerSecond = Number(process.env.SRGH_LOAD_REST_RPS || 333);
const messagesPerSecond = Number(process.env.SRGH_LOAD_MESSAGE_RPS || 2);
const batchSize = Number(process.env.SRGH_LOAD_SOCKET_BATCH || 100);
const batchDelayMs = Number(process.env.SRGH_LOAD_SOCKET_BATCH_DELAY_MS || 600);
const marker = `LOAD_10K_${Date.now()}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
};

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ employeeNumber: "1001", password: "1234" }),
});
if (!login.ok) throw new Error(`Login failed: ${login.status}`);
const { token } = await login.json();
const headers = { Authorization: `Bearer ${token}` };
const rooms = await fetch(`${baseUrl}/api/rooms`, { headers }).then(response => response.json());
const roomId = rooms[0]?.id;
if (!roomId) throw new Error("A load-test room is required.");

const sockets = [];
const connectDurations = [];
const messageIds = new Set();
let connected = 0;
let connectFailed = 0;
let socketClosed = 0;
let deliveries = 0;
let messagesSent = 0;
let messageSendFailed = 0;
let restSucceeded = 0;
let restFailed = 0;
let aborted = false;
let abortReason = "";
const restDurations = [];
const startedAt = performance.now();
const websocketBases = (process.env.SRGH_LOAD_WS_BASE_URLS || baseUrl)
  .split(",").map(value => value.trim().replace(/^http/, "ws")).filter(Boolean);
const sendFrame = (socket, frame) => socket.send(JSON.stringify([frame]));

function connectSocket(index) {
  return new Promise(resolve => {
    const started = performance.now();
    const sessionId = `${Date.now().toString(36)}${index.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const websocketBase = websocketBases[index % websocketBases.length];
    const socket = new WebSocket(`${websocketBase}/ws/${String(index % 1000).padStart(3, "0")}/${sessionId}/websocket`);
    let settled = false;
    const timeout = setTimeout(() => finish(false), 30000);
    const finish = success => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (success) {
        connected++;
        connectDurations.push(performance.now() - started);
        sockets.push(socket);
      } else {
        connectFailed++;
        try { socket.close(); } catch {}
      }
      resolve();
    };
    socket.onopen = () => undefined;
    socket.onmessage = event => {
      const packet = String(event.data);
      if (packet === "o") {
        sendFrame(socket, "CONNECT\naccept-version:1.2\nheart-beat:0,0\n\n\u0000");
        return;
      }
      if (!packet.startsWith("a")) return;
      let frames = [];
      try { frames = JSON.parse(packet.slice(1)); } catch { return; }
      for (const frame of frames) {
        if (frame.startsWith("CONNECTED")) {
          sendFrame(socket, `SUBSCRIBE\nid:load-${index}\ndestination:/topic/rooms/${roomId}\nack:auto\n\n\u0000`);
          finish(true);
        } else if (frame.startsWith("MESSAGE")) {
          deliveries++;
          if (index !== 0 || !frame.includes(marker)) continue;
          try {
            const payload = JSON.parse(frame.slice(frame.indexOf("\n\n") + 2).replace(/\u0000$/, ""));
            if (payload.id) messageIds.add(payload.id);
          } catch {}
        }
      }
    };
    socket.onerror = () => finish(false);
    socket.onclose = () => { socketClosed++; if (!settled) finish(false); };
  });
}

for (let offset = 0; offset < users && !aborted; offset += batchSize) {
  const count = Math.min(batchSize, users - offset);
  await Promise.all(Array.from({ length: count }, (_, index) => connectSocket(offset + index)));
  if (os.freemem() < 400 * 1024 * 1024) {
    aborted = true;
    abortReason = "Load generator free memory fell below 400 MB during ramp-up.";
  }
  if ((offset + count) % 1000 === 0) {
    console.log(JSON.stringify({ phase: "ramp", connected, connectFailed, elapsedSec: Math.round((performance.now() - startedAt) / 1000), freeMemoryMB: Math.round(os.freemem() / 1048576) }));
  }
  if (offset + count < users) await sleep(batchDelayMs);
}

const endpoints = ["/api/auth/me", "/api/directory/employees", "/api/directory/departments", "/api/rooms", "/api/notices"];
let restCursor = 0;
let senderCursor = 0;
const restTimer = setInterval(() => {
  for (let index = 0; index < restPerSecond; index++) {
    const path = endpoints[restCursor++ % endpoints.length];
    const requestStarted = performance.now();
    void fetch(`${baseUrl}${path}`, { headers, signal: AbortSignal.timeout(5000) }).then(async response => {
      await response.arrayBuffer();
      restDurations.push(performance.now() - requestStarted);
      response.ok ? restSucceeded++ : restFailed++;
    }).catch(() => restFailed++);
  }
}, 1000);

const messageTimer = setInterval(() => {
  for (let index = 0; index < messagesPerSecond; index++) {
    const socket = sockets[senderCursor++ % sockets.length];
    if (!socket || socket.readyState !== WebSocket.OPEN) { messageSendFailed++; continue; }
    try {
      const content = `${marker}_${messagesSent + 1}`;
      sendFrame(socket, `SEND\ndestination:/app/chat.send\ntoken:${token}\ncontent-type:application/json\n\n${JSON.stringify({ roomId, content, type: "TEXT" })}\u0000`);
      messagesSent++;
    } catch { messageSendFailed++; }
  }
}, 1000);

const progressTimer = setInterval(() => {
  const freeMemoryMB = Math.round(os.freemem() / 1048576);
  console.log(JSON.stringify({ phase: "hold", elapsedSec: Math.round((performance.now() - startedAt) / 1000), connected, alive: sockets.filter(socket => socket.readyState === WebSocket.OPEN).length, deliveries, messagesSent, restSucceeded, restFailed, freeMemoryMB }));
  if (freeMemoryMB < 350) {
    aborted = true;
    abortReason = "Load generator free memory fell below 350 MB.";
  }
}, 30000);

while (!aborted && performance.now() - startedAt < durationMs) await sleep(500);
clearInterval(restTimer);
clearInterval(messageTimer);
clearInterval(progressTimer);
await sleep(5000);
const aliveAtEnd = sockets.filter(socket => socket.readyState === WebSocket.OPEN).length;
for (const socket of sockets) {
  try { socket.close(); } catch {}
}

console.log("FINAL_RESULT=" + JSON.stringify({
  configuration: { baseUrl, websocketBases, users, durationMs, restPerSecond, messagesPerSecond, roomId, marker },
  aborted,
  abortReason,
  elapsedMs: Math.round(performance.now() - startedAt),
  websocket: {
    connected, connectFailed, aliveAtEnd, socketClosed, deliveries, messagesSent, messageSendFailed,
    p50ConnectMs: Math.round(percentile(connectDurations, .5)),
    p95ConnectMs: Math.round(percentile(connectDurations, .95)),
    p99ConnectMs: Math.round(percentile(connectDurations, .99)),
    maxConnectMs: Math.round(Math.max(0, ...connectDurations)),
  },
  rest: {
    succeeded: restSucceeded, failed: restFailed,
    p50Ms: Math.round(percentile(restDurations, .5)),
    p95Ms: Math.round(percentile(restDurations, .95)),
    p99Ms: Math.round(percentile(restDurations, .99)),
    maxMs: Math.round(Math.max(0, ...restDurations)),
  },
  cleanupMessageIds: [...messageIds],
}, null, 2));
