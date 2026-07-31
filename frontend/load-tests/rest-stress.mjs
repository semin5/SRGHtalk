import { performance } from "node:perf_hooks";

const baseUrl = process.env.SRGH_LOAD_BASE_URL || "http://localhost:3021";
const requestsPerStage = Number(process.env.SRGH_REST_REQUESTS_PER_STAGE || 3000);
const concurrencyStages = (process.env.SRGH_REST_CONCURRENCY_STAGES || "50,100,200")
  .split(",").map(Number).filter(Number.isFinite);

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
const endpoints = ["/api/auth/me", "/api/directory/employees", "/api/directory/departments", "/api/rooms", "/api/notices"];

const percentile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0;
};

async function request(path, options = {}) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers, ...options.headers } });
    await response.arrayBuffer();
    return { ok: response.ok, status: response.status, duration: performance.now() - started };
  } catch {
    return { ok: false, status: 0, duration: performance.now() - started };
  }
}

const results = [];
for (const concurrency of concurrencyStages) {
  const durations = [];
  const statuses = {};
  let succeeded = 0;
  const started = performance.now();
  for (let offset = 0; offset < requestsPerStage; offset += concurrency) {
    const count = Math.min(concurrency, requestsPerStage - offset);
    const batch = await Promise.all(Array.from({ length: count }, (_, index) =>
      request(endpoints[(offset + index) % endpoints.length])));
    for (const item of batch) {
      durations.push(item.duration);
      statuses[item.status] = (statuses[item.status] || 0) + 1;
      if (item.ok) succeeded++;
    }
  }
  const elapsed = performance.now() - started;
  results.push({
    concurrency,
    requests: requestsPerStage,
    succeeded,
    failed: requestsPerStage - succeeded,
    requestsPerSecond: Number((requestsPerStage / (elapsed / 1000)).toFixed(2)),
    elapsedMs: Math.round(elapsed),
    p50Ms: Math.round(percentile(durations, .50)),
    p95Ms: Math.round(percentile(durations, .95)),
    p99Ms: Math.round(percentile(durations, .99)),
    maxMs: Math.round(Math.max(...durations)),
    statuses,
  });
}

let readTest;
if (roomId) {
  const messages = await fetch(`${baseUrl}/api/rooms/${roomId}/messages`, { headers }).then(response => response.json());
  const messageId = messages.at(-1)?.id;
  if (messageId) {
    const count = 2000;
    const concurrency = 200;
    const durations = [];
    let succeeded = 0;
    const started = performance.now();
    for (let offset = 0; offset < count; offset += concurrency) {
      const batch = await Promise.all(Array.from({ length: Math.min(concurrency, count - offset) }, () =>
        request(`/api/rooms/${roomId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId }),
        })));
      for (const item of batch) {
        durations.push(item.duration);
        if (item.ok) succeeded++;
      }
    }
    const elapsed = performance.now() - started;
    readTest = {
      requests: count,
      concurrency,
      succeeded,
      failed: count - succeeded,
      requestsPerSecond: Number((count / (elapsed / 1000)).toFixed(2)),
      p95Ms: Math.round(percentile(durations, .95)),
      p99Ms: Math.round(percentile(durations, .99)),
      maxMs: Math.round(Math.max(...durations)),
    };
  }
}

console.log(JSON.stringify({ mixedReadStages: results, readReceiptWrites: readTest }, null, 2));
