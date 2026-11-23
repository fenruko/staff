/* Cached id -> name resolution. Users via /users/resolve (batched), guilds via
 * one /guilds fetch. Nodes returned by userLabel/guildLabel update themselves
 * when a name arrives, so tables can render instantly with raw ids. */
import { api } from "./api.js";
import { h } from "./dom.js";
import { isSnowflake, shortId } from "./format.js";

const BATCH = 50;
const users = new Map(); // id -> {username, avatar} | null
const pending = new Set();
let flushTimer = null;
let guilds = null; // Map id -> guild
let guildsPromise = null;
let guildsRetryAt = 0;
const labels = new Set(); // {node, kind, id, born}
const watchers = new Set();

export const resetResolver = () => { users.clear(); pending.clear(); guilds = null; guildsPromise = null; guildsRetryAt = 0; labels.clear(); clearTimeout(flushTimer); flushTimer = null; };
export const onResolved = (fn) => (watchers.add(fn), () => watchers.delete(fn));
export const cachedUser = (id) => users.get(String(id)) || null;
export const cachedGuild = (id) => guilds?.get(String(id)) || null;
export const guildNameOf = (id) => cachedGuild(id)?.name || null;
export const userNameOf = (id) => cachedUser(id)?.username || null;

function paint() {
  const now = Date.now();
  for (const l of [...labels]) {
    if (!l.node.isConnected && now - l.born > 4000) { labels.delete(l); continue; }
    fill(l);
  }
  watchers.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

function fill(l) {
  const name = l.kind === "guild" ? guildNameOf(l.id) : userNameOf(l.id);
  const main = l.node.firstChild;
  if (name) {
    main.textContent = name;
    l.node.title = l.id;
    l.node.classList.add("resolved");
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const ids = [...pending];
    pending.clear();
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      try {
        const res = await api.resolveUsers(chunk);
        for (const id of chunk) users.set(id, res?.[id] || null);
      } catch {
        // Don't cache failures: allow a retry on a later render.
      }
    }
    paint();
  }, 30);
}

export function requestUsers(ids) {
  for (const raw of ids) {
    const id = String(raw ?? "");
    if (!isSnowflake(id) || users.has(id) || pending.has(id)) continue;
    pending.add(id);
  }
  if (pending.size) scheduleFlush();
}

export function ensureGuilds() {
  if (guilds) return Promise.resolve(guilds);
  if (guildsPromise) return guildsPromise;
  if (Date.now() < guildsRetryAt) return Promise.resolve(new Map());
  guildsPromise = api.guilds().then((list) => {
    guilds = new Map((Array.isArray(list) ? list : []).map((g) => [String(g.id), g]));
    paint();
    return guilds;
  }).catch(() => {
    guildsRetryAt = Date.now() + 60000; // no guilds.view, or backend down: don't spam
    return new Map();
  }).finally(() => { guildsPromise = null; });
  return guildsPromise;
}

function label(kind, id, { idOnly = false } = {}) {
  const sid = String(id ?? "");
  if (!sid) return h("span", { class: "who muted" }, "—");
  const node = h("span", { class: "who", title: sid }, h("span", { class: "who-name" }, shortId(sid)));
  const l = { node, kind, id: sid, born: Date.now() };
  if (!idOnly) {
    labels.add(l);
    if (kind === "user") requestUsers([sid]);
    else ensureGuilds();
    fill(l);
  }
  return node;
}

export const userLabel = (id, o) => label("user", id, o);
export const guildLabel = (id, o) => label("guild", id, o);
