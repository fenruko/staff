/* Bot API client. Base URL comes from /config.js (window.STAFF_CONFIG.apiBase)
 * so no build-time env var is needed. */

const DEFAULT_BASE = "https://api.rift.cool";
const TOKEN_KEY = "rift_staff_token";

export const getApiBase = () => String(globalThis.STAFF_CONFIG?.apiBase || DEFAULT_BASE).replace(/\/+$/, "");

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// When the backend can't be reached at all, pause outgoing requests for a
// growing cooldown and fail them locally so the console isn't flooded and the
// bot isn't hammered the moment it comes back.
let networkFailures = 0;
let backendDownUntil = 0;
const netListeners = new Set();
let authLostHandler = null;

export const isBackendDown = () => Date.now() < backendDownUntil;
export const backendDownRemaining = () => Math.max(0, backendDownUntil - Date.now());
export const onNetworkChange = (fn) => (netListeners.add(fn), () => netListeners.delete(fn));
export const onAuthLost = (fn) => { authLostHandler = fn; };
export function resetBackoff() { networkFailures = 0; backendDownUntil = 0; }
const emitNet = () => netListeners.forEach((fn) => { try { fn({ down: isBackendDown(), until: backendDownUntil }); } catch { /* ignore */ } });

function unreachable() {
  const err = new ApiError("Can't reach the Rift backend right now. Retrying shortly.", 0, null);
  err.network = true;
  return err;
}

export async function request(path, { method = "GET", body, params, force = false, signal } = {}) {
  if (!force && isBackendDown()) throw unreachable();
  let url = `${getApiBase()}${path}`;
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
    if (qs) url += `?${qs}`;
  }
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, signal, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    if (e?.name === "AbortError") throw e; // navigation, not an outage
    networkFailures += 1;
    backendDownUntil = Date.now() + Math.min(2000 * 2 ** (networkFailures - 1), 60000);
    emitNet();
    throw unreachable();
  }
  if (networkFailures) { networkFailures = 0; backendDownUntil = 0; emitNet(); }

  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    if (res.status === 401 && getToken()) {
      setToken(null);
      authLostHandler?.();
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

const q = (path, params) => (o) => request(path, { params, ...o });
const send = (method, path, body) => (o) => request(path, { method, body, ...o });
const enc = encodeURIComponent;

/* Every helper takes a trailing options object: { signal }. */
export const api = {
  // auth
  login: (username, password, totp_code) => request("/api/exec/login", { method: "POST", body: { username, password, totp_code }, force: true }),
  logout: (o) => send("POST", "/api/exec/logout")(o),
  me: (o) => q("/api/exec/me")(o),

  // directory
  resolveUsers: (ids, o) => request("/api/exec/users/resolve", { params: { ids: ids.join(",") }, ...o }),
  searchMembers: (query, o) => request("/api/exec/members/search", { params: { q: query }, ...o }),

  // appeals (users appeal on the dashboard; staff review here)
  listAppeals: (status, o) => request("/api/exec/appeals", { params: { status }, ...o }),
  getAppeal: (id, o) => q(`/api/exec/appeals/${enc(id)}`)(o),
  claimAppeal: (id, o) => send("POST", `/api/exec/appeals/${enc(id)}/claim`)(o),
  unclaimAppeal: (id, o) => send("POST", `/api/exec/appeals/${enc(id)}/unclaim`)(o),
  messageAppeal: (id, text, attachment_ids, o) => send("POST", `/api/exec/appeals/${enc(id)}/message`, { text, attachment_ids })(o),
  uploadExecAppealImage: (id, image, o) => send("POST", `/api/exec/appeals/${enc(id)}/upload`, { image })(o),
  resolveAppeal: (id, decision, note, o) => send("POST", `/api/exec/appeals/${enc(id)}/resolve`, { decision, note })(o),
  blacklistFromAppeal: (id, reason, o) => send("POST", `/api/exec/appeals/${enc(id)}/blacklist`, { reason })(o),
  unblacklistFromAppeal: (id, o) => send("POST", `/api/exec/appeals/${enc(id)}/unblacklist`)(o),

  // blacklist
  listBlacklist: (o) => q("/api/exec/blacklist")(o),
  lookupBlacklistUser: (id, o) => q(`/api/exec/blacklist/lookup/${enc(id)}`)(o),
  blacklistHistory: (id, o) => q(`/api/exec/blacklist/${enc(id)}/history`)(o),
  addBlacklist: (user_id, reason, evidence, duration, o) => send("POST", "/api/exec/blacklist", { user_id, reason, evidence, duration })(o),
  removeBlacklist: (id, o) => send("DELETE", `/api/exec/blacklist/${enc(id)}`)(o),

  // economy
  economySearch: (id, o) => q(`/api/exec/economy/search/${enc(id)}`)(o),
  economyAdjust: (payload, o) => send("POST", "/api/exec/economy/adjust", payload)(o),
  economyInbox: (status = "pending", o) => request("/api/exec/economy/inbox", { params: { status }, ...o }),
  economyInboxResolve: (id, decision, o) => send("POST", `/api/exec/economy/inbox/${enc(id)}/resolve`, { decision })(o),

  // analytics (list `limit` is clamped 1..500 server-side; logs `lines` 1..1000)
  overview: (o) => q("/api/exec/overview")(o),
  economy: (limit, o) => request("/api/exec/economy", { params: { limit }, ...o }),
  moderation: (days, o) => request("/api/exec/moderation", { params: { days }, ...o }),
  tickets: (o) => q("/api/exec/tickets")(o),
  voice: (limit, o) => request("/api/exec/voice", { params: { limit }, ...o }),
  verification: (limit, o) => request("/api/exec/verification", { params: { limit }, ...o }),
  levels: (limit, o) => request("/api/exec/levels", { params: { limit }, ...o }),
  invites: (limit, o) => request("/api/exec/invites", { params: { limit }, ...o }),
  giveaways: (o) => q("/api/exec/giveaways")(o),
  confessions: (o) => q("/api/exec/confessions")(o),
  errorLogs: (lines, o) => request("/api/exec/logs/errors", { params: { lines }, ...o }),
  auditLog: (limit, o) => request("/api/exec/audit-log", { params: { limit }, ...o }),

  // guilds
  guilds: (o) => q("/api/exec/guilds")(o),
  guildDetail: (id, o) => q(`/api/exec/guilds/${enc(id)}`)(o),
  leaveGuild: (id, o) => send("POST", `/api/exec/guilds/${enc(id)}/leave`)(o),

  // staff
  listStaff: (o) => q("/api/exec/staff")(o),
  createStaff: (payload, o) => send("POST", "/api/exec/staff", payload)(o),
  updateStaff: (id, payload, o) => send("PATCH", `/api/exec/staff/${enc(id)}`, payload)(o),
  deleteStaff: (id, o) => send("DELETE", `/api/exec/staff/${enc(id)}`)(o),
  permissionCatalog: (o) => q("/api/exec/permissions")(o),

  // bug reports
  listBugReports: (status, o) => request("/api/exec/bugreports", { params: { status }, ...o }),
  resolveBugReport: (id, decision, o) => send("POST", `/api/exec/bugreports/${enc(id)}/resolve`, { decision })(o),

  // moderation
  modUserLookup: (query, guildId, o) => request("/api/exec/mod/user", { params: { q: query, guild_id: guildId }, ...o }),
  modAction: (payload, o) => send("POST", "/api/exec/mod/action", payload)(o),

  // bot control. Cog routes take the extension's short module name ("music").
  botCogs: (o) => q("/api/exec/bot/cogs")(o),
  botExtensions: (o) => q("/api/exec/bot/extensions")(o),
  reloadCog: (name, o) => send("POST", `/api/exec/bot/cogs/${enc(name)}/reload`)(o),
  unloadCog: (name, o) => send("POST", `/api/exec/bot/cogs/${enc(name)}/unload`)(o),
  loadCog: (name, o) => send("POST", `/api/exec/bot/cogs/${enc(name)}/load`)(o),
  getMaintenance: (o) => q("/api/exec/bot/maintenance")(o),
  setMaintenance: (maintenance, message, o) => send("POST", "/api/exec/bot/maintenance", { maintenance, message })(o),
  restartBot: (o) => send("POST", "/api/exec/bot/restart")(o),
  shutdownBot: (o) => send("POST", "/api/exec/bot/shutdown")(o),
  broadcast: (message, target = "all", o) => send("POST", "/api/exec/broadcast", { message, target })(o),
};

// <img> tags can't send Authorization headers, so staff attachment URLs carry the token.
const withToken = () => { const t = getToken(); return t ? `?staff_token=${enc(t)}` : ""; };
export const attachmentUrl = (id) => `${getApiBase()}/api/appeals/attachments/${enc(id)}${withToken()}`;
export const bugAttachmentUrl = (id) => `${getApiBase()}/api/bugreports/attachments/${enc(id)}${withToken()}`;
