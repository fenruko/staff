import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.location = { origin: "https://staff.test", pathname: "/" };
globalThis.STAFF_CONFIG = { apiBase: "https://api.test/" };
const { request, api, isBackendDown, resetBackoff, setToken, onAuthLost, getApiBase, attachmentUrl, ApiError } = await import("../../assets/app/core/api.js");

const json = (status, data) => ({ ok: status < 400, status, json: async () => data });

test("api: base from config (trailing slash trimmed), bearer token, query params skip empties", async () => {
  setToken("tok");
  let seen;
  globalThis.fetch = async (url, init) => { seen = { url, init }; return json(200, { ok: 1 }); };
  await api.moderation(30);
  assert.equal(getApiBase(), "https://api.test");
  assert.equal(seen.url, "https://api.test/api/exec/moderation?days=30");
  assert.equal(seen.init.headers.Authorization, "Bearer tok");
  await request("/x", { params: { a: "", b: null, c: 0 } });
  assert.equal(seen.url, "https://api.test/x?c=0");
  assert.match(attachmentUrl("a/b"), /attachments\/a%2Fb\?staff_token=tok$/);
});

test("api: network failure opens an exponential backoff and fails locally", async () => {
  resetBackoff();
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError("Failed to fetch"); };
  await assert.rejects(request("/a"), (e) => e.network === true);
  assert.equal(isBackendDown(), true);
  await assert.rejects(request("/a"), (e) => e.network);
  assert.equal(calls, 1, "second request fails locally without hitting the network");
  const forced = request("/a", { force: true });
  await assert.rejects(forced);
  assert.equal(calls, 2);
  resetBackoff();
  assert.equal(isBackendDown(), false);
});

test("api: abort is not treated as an outage", async () => {
  resetBackoff();
  globalThis.fetch = async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); };
  await assert.rejects(request("/a"), (e) => e.name === "AbortError");
  assert.equal(isBackendDown(), false);
});

test("api: 401 clears the token and notifies; error text comes from {error}", async () => {
  setToken("tok");
  let lost = 0;
  onAuthLost(() => lost++);
  globalThis.fetch = async () => json(401, { error: "Session expired" });
  await assert.rejects(api.me(), (e) => e instanceof ApiError && e.status === 401 && e.message === "Session expired");
  assert.equal(lost, 1);
  assert.equal(store.has("rift_staff_token"), false);
  globalThis.fetch = async () => json(400, { error: "Bad cog" });
  await assert.rejects(api.reloadCog("music"), /Bad cog/);
});

test("api: cog routes take the module short name", async () => {
  let url;
  globalThis.fetch = async (u) => { url = u; return json(200, {}); };
  await api.reloadCog("music");
  assert.match(url, /\/api\/exec\/bot\/cogs\/music\/reload$/);
  await api.botExtensions();
  assert.match(url, /\/api\/exec\/bot\/extensions$/);
});

/* ---- websocket: single shared socket, exponential reconnect ---- */
test("ws: one shared socket, reconnect delay doubles and caps, closes with last subscriber", async () => {
  const sockets = [];
  class FakeWS { constructor(u) { this.url = String(u); sockets.push(this); } close() { this.closed = true; this.onclose?.(); } }
  globalThis.WebSocket = FakeWS;
  setToken("tok");
  const realTimeout = globalThis.setTimeout;
  const timers = [];
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  const { connectExecSocket, socketRetryDelay } = await import("../../assets/app/core/ws.js");
  const msgs = [];
  const off1 = connectExecSocket((m) => msgs.push(m));
  const off2 = connectExecSocket(() => {});
  assert.equal(sockets.length, 1, "shared");
  assert.match(sockets[0].url, /^wss:\/\/api\.test\/ws\/exec\?token=tok$/);
  sockets[0].onopen();
  sockets[0].onmessage({ data: JSON.stringify({ type: "x" }) });
  sockets[0].onmessage({ data: "not json" });
  assert.equal(msgs.length, 1);
  const delays = [];
  for (let i = 0; i < 7; i++) {
    sockets.at(-1).onclose();
    const t = timers.at(-1); delays.push(t.ms); t.fn();
  }
  assert.deepEqual(delays.slice(0, 4), [1000, 2000, 4000, 8000]);
  assert.equal(Math.max(...delays), 30000);
  assert.ok(socketRetryDelay() <= 30000);
  off1(); off2();
  assert.equal(sockets.at(-1).closed, true);
  globalThis.setTimeout = realTimeout;
});
