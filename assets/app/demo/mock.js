/* DEMO-ONLY in-browser stand-in for the bot's Quart API (contract incl. the new
 * overview/guild/extension fields). Loaded lazily, only when demo mode is on.
 * Sign in as `demo` (full access) or `mira` (limited) with any password. */
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (l) => l[rand(0, l.length - 1)];
const now = () => Math.floor(Date.now() / 1000);
const NAMES = ["nova", "kirito", "mira", "ashes", "véga", "drift", "june", "solstice", "echo", "miyo", "atlas", "ren", "kestrel", "lumen", "pax", "sable", "rio", "wren", "onyx", "cyra"];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m, s = 400) => { throw new HttpError(s, m); };

const ALL_PERMS = [
  ["overview.view", "View the overview page", "General"], ["economy.view", "View economy stats", "Economy"], ["economy.manage", "Adjust balances", "Economy"],
  ["economy.approve", "Approve balance adjustments", "Economy"], ["moderation.view", "View moderation stats", "Moderation"], ["moderation.lookup", "Look up users", "Moderation"],
  ["moderation.warn", "Warn members", "Moderation"], ["moderation.timeout", "Timeout members", "Moderation"], ["moderation.kick", "Kick members", "Moderation"],
  ["moderation.ban", "Ban members", "Moderation"], ["tickets.view", "View tickets & reports", "Support"], ["appeals.view", "View ban appeals", "Support"],
  ["appeals.manage", "Claim and resolve appeals", "Support"], ["bugreports.view", "View bug reports", "Support"], ["bugreports.manage", "Resolve bug reports", "Support"],
  ["blacklist.manage", "Manage blacklist", "Support"], ["voice.view", "View voice stats", "Analytics"], ["verification.view", "View verification flags", "Analytics"],
  ["levels.view", "View leaderboards", "Analytics"], ["invites.view", "View invite leaderboard", "Analytics"], ["giveaways.view", "View giveaway stats", "Analytics"],
  ["guilds.view", "View guilds", "Bot"], ["guilds.leave", "Make the bot leave guilds", "Bot"], ["logs.view", "View error logs", "Bot"], ["audit.view", "View audit log", "Bot"],
  ["bot.control", "Manage cogs and maintenance", "Bot"], ["bot.restart", "Restart the bot", "Bot"], ["bot.shutdown", "Shut the bot down", "Bot"],
  ["broadcast.send", "Send broadcasts", "Bot"], ["blog.post", "Write blog posts", "General"], ["staff.manage", "Manage staff accounts", "Staff"],
].map(([key, label, category]) => ({ key, label, category }));
const LIMITED = ["overview.view", "moderation.view", "moderation.lookup", "moderation.warn", "moderation.timeout", "tickets.view", "appeals.view", "appeals.manage", "bugreports.view", "economy.view"];

const U = ["445190237866231", "771230948821134", "411998023311441", "900331244551002", "122094568833127", "666120334551001", "777550119022334"];
const G = [
  { id: "902137184576231", name: "Rift HQ", member_count: 48213, boost_level: 3, boost_count: 22, channel_count: 84, role_count: 41, shard_id: 0 },
  { id: "559028374615522", name: "Trade Post", member_count: 23450, boost_level: 0, boost_count: 0, channel_count: 36, role_count: 19, shard_id: 1 },
  { id: "774920358162449", name: "Midnight Lounge", member_count: 9104, boost_level: 2, boost_count: 8, channel_count: 52, role_count: 27, shard_id: 0 },
  { id: "680231754902341", name: "Dev Playground", member_count: 642, boost_level: 1, boost_count: 2, channel_count: 18, role_count: 12, shard_id: 1 },
];
const EXT = [
  ["admin", ["Admin"]], ["antinuke", ["AntiNuke"]], ["appeals", ["Appeals"]], ["economy", ["Economy"]], ["events", ["Events"]], ["gambling", ["Gambling"]],
  ["giveaways", ["Giveaways"]], ["levels", ["Levels"]], ["moderation", ["Moderation"]], ["music", ["Music", "FuckOff"]], ["tickets", ["Tickets"]],
  ["verification", ["Verification"]], ["voice", ["Voice"]], ["web_server", ["WebServer"]], ["stocks", ["Stocks"]],
];

function makeDb() {
  return {
    staff: [
      { id: 1, username: "demo_admin", role: "Founder", permissions: ["*"], totp_enabled: true, last_login: now() - 600, discord_id: U[0] },
      { id: 2, username: "mira", role: "Support Lead", permissions: LIMITED, totp_enabled: true, last_login: now() - 86400, discord_id: U[1] },
      { id: 3, username: "atlas", role: "Moderator", permissions: ["overview.view", "moderation.view", "moderation.warn", "tickets.view"], totp_enabled: false, last_login: null },
    ],
    inbox: [
      { id: 1, user_id: U[0], guild_id: G[0].id, amount: 250000, reason: "Event prize payout", staff_username: "mira", status: "pending", created_at: now() - 3600 },
      { id: 2, user_id: U[1], guild_id: G[2].id, amount: -5000, reason: "Rollback after dupe", staff_username: "atlas", status: "pending", created_at: now() - 7200 },
    ],
    appeals: [
      { id: 1, user_id: U[2], username_snapshot: "ashes", avatar_snapshot: null, status: "open", reason: "I was falsely flagged, the anticheat misread my macros.", evidence: "clip: example.com/clip", created_at: now() - 5400, evidence_attachment_ids: [], messages: [{ is_staff: false, text: "Please look at the clip.", attachment_ids: [], created_at: now() - 5000 }], claimed_by_username: null, blacklist_status: { blacklisted: true, banned_by_username: "mira", reason: "Cheating in events" } },
      { id: 2, user_id: U[3], username_snapshot: "drift", avatar_snapshot: null, status: "open", reason: "Never scammed anyone.", created_at: now() - 96000, evidence_attachment_ids: [], messages: [], claimed_by_username: null, likely_troll: true, blacklist_status: { blacklisted: false } },
      { id: 3, user_id: U[4], username_snapshot: "june", avatar_snapshot: null, status: "claimed", reason: "Ban evasion was a family member.", created_at: now() - 200000, evidence_attachment_ids: [], messages: [], claimed_by_username: "demo_admin", blacklist_status: { blacklisted: true, banned_by_username: "atlas", reason: "Ban evasion" } },
      { id: 4, user_id: U[6], username_snapshot: "echo", avatar_snapshot: null, status: "approved", reason: "Hacked account.", created_at: now() - 900000, evidence_attachment_ids: [], messages: [], claimed_by_username: "mira", blacklist_status: { blacklisted: false } },
    ],
    bugs: [
      { id: 1, reporter_user_id: U[2], status: "open", description: "/daily streak resets if you claim at exactly midnight UTC.", attachments: [], created_at: now() - 43200 },
      { id: 2, reporter_user_id: U[3], status: "accepted", description: "Leaderboard page 2 shows page 1 again.", attachments: [], created_at: now() - 172800, reviewed_by_username: "mira", reward_granted: true },
      { id: 3, reporter_user_id: U[2], status: "rejected", description: "Bot is too slow", attachments: [], created_at: now() - 272800 },
    ],
    blacklist: [
      { user_id: U[5], reason: "Raid botnet operator", evidence: "alt list", banned_by_username: "demo_admin", banned_at: now() - 86400 * 6, duration_label: null },
      { user_id: U[6], reason: "Repeated scam links", evidence: null, banned_by_username: "mira", banned_at: now() - 86400 * 20, duration_label: "30d" },
    ],
    guilds: G.map((g, i) => ({ ...g, owner_id: [U[0], U[3], U[4], U[5]][i], created_at: new Date(Date.now() - (i + 2) * 86400000 * 200).toISOString(), joined_at: new Date(Date.now() - (i + 1) * 86400000 * 120).toISOString(), icon: null })),
    ext: EXT.map(([name, cogs]) => ({ name, module: `cogs.${name}`, loaded: name !== "stocks", cogs, protected: name === "web_server" })),
    maintenance: { maintenance: false, message: "" },
    live: { latency: 96, cpu: 23.5, ram: 34 },
    audit: [],
  };
}

const IDS = new Map();
const nameFor = (id) => { if (!IDS.has(id)) IDS.set(id, `${pick(NAMES)}${rand(10, 99)}`); return IDS.get(id); };

export function createMock() {
  const db = makeDb();
  const audit = (username, action, target) => db.audit.unshift({ id: db.audit.length + 1, username, action, target, ip: `10.0.0.${rand(2, 250)}`, timestamp: now() });
  for (let i = 0; i < 24; i++) db.audit.push({ id: i, username: pick(["demo_admin", "mira", "atlas"]), action: pick(["login", "economy.adjust", "appeal.resolve", "blacklist.add", "bot.reload_cog", "broadcast"]), target: pick(["user 445190…", "appeal #2", "cog economy", "user 666120…"]), ip: `10.0.${rand(0, 4)}.${rand(2, 250)}`, timestamp: now() - i * 1900 });

  function overview() {
    const l = db.live;
    l.latency = Math.max(45, Math.min(340, l.latency + rand(-14, 14)));
    l.cpu = Math.max(4, Math.min(93, l.cpu + (Math.random() - 0.48) * 6));
    l.ram = Math.max(20, Math.min(90, l.ram + (Math.random() - 0.5) * 2));
    const loaded = db.ext.filter((e) => e.loaded);
    return {
      servers: 4, guild_count: 4, users: 81843 + rand(-6, 6), latency: Math.round(l.latency), shards: 2, uptime: 86400 * 12 + 3600 * rand(2, 20),
      cpu: Number(l.cpu.toFixed(1)), ram_percent: Number(l.ram.toFixed(1)), ram_used: Math.round(40.96 * l.ram), ram_total: 4096, voice_connections: rand(0, 4),
      cogs_loaded: loaded.flatMap((e) => e.cogs), cog_count: loaded.flatMap((e) => e.cogs).length,
      disk_percent: 61.2, process_rss_mb: 412, threads: 38, load_avg: [0.42, 0.55, 0.61], python: "3.12.4", discord_py: "2.5.2",
      text_channels: 142, voice_channels: 31, commands: 318, exec_clients: 2, maintenance: db.maintenance.maintenance,
    };
  }

  const guild = (id) => db.guilds.find((g) => g.id === id) || bad("Guild not found", 404);
  const apId = (path) => Number(path.split("/")[4]);

  const routes = {
    "POST /api/exec/login": ({ body }) => {
      const u = body?.username;
      if (u === "demo" || u === "demo_admin") return { token: "demo-token", id: 1, username: "demo_admin", role: "Founder", permissions: ["*"] };
      if (u === "mira") return { token: "limited-token", id: 2, username: "mira", role: "Support Lead", permissions: LIMITED };
      bad("Invalid credentials. Try username “demo”, any password.", 401);
    },
    "POST /api/exec/logout": () => ({ ok: true }),
    "GET /api/exec/me": ({ session }) => session,
    "GET /api/exec/overview": () => overview(),
    "GET /api/exec/economy": ({ q }) => {
      const limit = Math.min(500, Math.max(1, Number(q.get("limit")) || 25));
      const lb = Array.from({ length: Math.min(limit, 60) }, (_, i) => ({ user_id: String(445190237866231 + i * 7919), guild_id: G[i % 4].id, balance: Math.round(9_400_000 / (i + 1.35)) }));
      return { totals: { total_accounts: 24118, total_balance: lb.reduce((a, r) => a + r.balance, 0) * 61, average_balance: 8432, richest_balance: lb[0].balance }, leaderboard: lb };
    },
    "GET /api/exec/economy/search/": ({ path }) => {
      const id = path.split("/").pop();
      return { user_id: id, username: nameFor(id), avatar: null, balances: [{ balance: rand(1200, 480000) }], adjustments: Array.from({ length: 4 }, (_, i) => ({ id: i, amount: rand(-40000, 40000), reason: pick(["Event payout", "Refund", "Dupe rollback"]), status: pick(["approved", "pending"]), staff_username: pick(["mira", "atlas", "demo_admin"]), created_at: now() - rand(600, 260000) })) };
    },
    "POST /api/exec/economy/adjust": ({ body }) => { if (!body.amount) bad("Amount required"); audit("demo_admin", "economy.adjust", `user ${body.user_id}`); return Math.abs(body.amount) > 100000 ? { status: "pending" } : { status: "applied", balance_after: rand(10000, 900000) }; },
    "GET /api/exec/economy/inbox": ({ q }) => db.inbox.filter((i) => !q.get("status") || i.status === q.get("status")),
    "POST /api/exec/economy/inbox/": ({ path, body }) => { const it = db.inbox.find((i) => i.id === Number(path.split("/")[5])); if (!it) bad("Not found", 404); it.status = body.decision; return { ok: true }; },
    "GET /api/exec/moderation": ({ q }) => {
      const days = Math.min(365, Math.max(1, Number(q.get("days")) || 7));
      const k = days / 7;
      return {
        warnings: { total: 1287, top_guilds: G.map((g, i) => ({ guild_id: g.id, count: 400 - i * 90 })) },
        action_counts: { warn: Math.round(342 * k), timeout: Math.round(118 * k), kick: Math.round(27 * k), ban: Math.round(41 * k) },
        top_moderators: [[U[0], 41, 12, 30, 201], [U[1], 0, 9, 22, 88], [U[4], 0, 6, 11, 53]].map(([moderator_id, bans, kicks, mutes, warns]) => ({ moderator_id, bans, kicks, mutes, warns, total: bans + kicks + mutes + warns })),
        recent_actions: Array.from({ length: 8 }, (_, i) => ({ id: i, action_type: pick(["warn", "timeout", "kick", "ban"]), moderator_id: pick(U.slice(0, 3)), target_id: pick(U), reason: pick(["Spamming invites", "Toxicity", "Scam links", "NSFW avatar"]), guild_id: pick(G).id })),
        antinuke_logs: [{ guild_id: G[0].id, actor_id: U[5], event_type: "mass_ban", count: 14, punishment: "blacklisted + roles reverted" }],
      };
    },
    "GET /api/exec/mod/user": ({ q }) => {
      const id = q.get("q");
      if (!id) bad("Query required");
      const mutual = G.slice(0, 3).map((g) => ({ id: g.id, name: g.name, icon: null, member_count: g.member_count || 0 }));
      const g = G.find((x) => x.id === q.get("guild_id")) || G[0];
      return { user: { id, name: nameFor(id), username: nameFor(id), avatar: null, is_banned: false, timed_out: false }, guild_id: g.id, guild_name: g.name, mutual_guilds: mutual, warn_count: 3, warnings: Array.from({ length: 3 }, (_, i) => ({ id: i, reason: pick(["Spam", "Slurs", "Mini-modding"]), moderator: pick(["mira", "atlas"]) })) };
    },
    "POST /api/exec/mod/action": ({ body }) => { audit("demo_admin", `mod.${body.action}`, `user ${body.target}`); return { status: `${body.action} dispatched to ${(G.find((x) => x.id === body.guild_id) || G[0]).name}` }; },
    "GET /api/exec/tickets": () => ({ tickets: { open: 14, closed: 892, avg_resolution_seconds: 3720 }, modmail: { open: 5, total: 318 }, reports: { total: 128, by_status: { open: 9, resolved: 101, rejected: 18 } } }),
    "GET /api/exec/appeals": ({ q }) => db.appeals.filter((a) => !q.get("status") || a.status === q.get("status")).map(({ messages, ...r }) => r),
    "GET /api/exec/appeals/": ({ path }) => db.appeals.find((a) => a.id === apId(path)) || bad("Not found", 404),
    "POST /api/exec/appeals/": ({ path, body, session }) => {
      const a = db.appeals.find((x) => x.id === apId(path)) || bad("Not found", 404);
      const act = path.split("/")[5];
      if (act === "claim") { a.status = "claimed"; a.claimed_by_username = session.username; }
      else if (act === "unclaim") { a.status = "open"; a.claimed_by_username = null; }
      else if (act === "message") a.messages.push({ is_staff: true, text: body.text, attachment_ids: body.attachment_ids || [], created_at: now() });
      else if (act === "resolve") a.status = body.decision;
      else if (act === "upload") return { id: `att-${rand(1, 9999)}` };
      else if (act === "blacklist") a.blacklist_status = { blacklisted: true, banned_by_username: session.username, reason: body.reason };
      else if (act === "unblacklist") a.blacklist_status = { blacklisted: false };
      return { ok: true };
    },
    "GET /api/exec/bugreports": ({ q }) => db.bugs.filter((r) => !q.get("status") || q.get("status") === "all" || r.status === q.get("status")),
    "POST /api/exec/bugreports/": ({ path, body }) => { const r = db.bugs.find((x) => x.id === Number(path.split("/")[4])) || bad("Not found", 404); r.status = body.decision; return { ok: true }; },
    "GET /api/exec/blacklist": () => db.blacklist,
    "GET /api/exec/blacklist/lookup/": ({ path }) => { const id = path.split("/").pop(); const e = db.blacklist.find((b) => b.user_id === id); return { user_id: id, username: nameFor(id), avatar: null, already_blacklisted: !!e, entry: e }; },
    "GET /api/exec/blacklist/": ({ path }) => path.endsWith("/history") ? Array.from({ length: 2 }, (_, i) => ({ id: i, action: i ? "add" : "remove", user_id: path.split("/")[4], reason: pick(["Scam links", "Raiding"]), staff_username: pick(["mira", "demo_admin"]), created_at: now() - 86400 * (i + 1) * 30, duration_label: i ? null : "30d" })) : bad("Not found", 404),
    "POST /api/exec/blacklist": ({ body }) => { if (!body.reason) bad("Reason required"); db.blacklist.unshift({ user_id: body.user_id, reason: body.reason, evidence: body.evidence, banned_by_username: "demo_admin", banned_at: now(), duration_label: body.duration === "permanent" ? null : body.duration }); return { ok: true }; },
    "DELETE /api/exec/blacklist/": ({ path }) => { const id = path.split("/").pop(); if (!db.blacklist.some((b) => b.user_id === id)) bad("Not blacklisted", 404); db.blacklist = db.blacklist.filter((b) => b.user_id !== id); return { ok: true }; },
    "GET /api/exec/voice": ({ q }) => ({ active_sessions: [{ guild_name: G[0].name, channel: "Lounge", listeners: rand(3, 18) }, { guild_name: G[2].name, channel: "Study Room", listeners: rand(1, 9) }], voice_xp_leaderboard: Array.from({ length: Math.min(50, Number(q.get("limit")) || 10) }, (_, i) => ({ guild_id: G[i % 4].id, user_id: String(411998023311441 + i * 613), minutes: 2400 - i * 31 })) }),
    "GET /api/exec/verification": () => ({ flags: Array.from({ length: 12 }, (_, i) => ({ user_id: pick(U), matched_user_id: String(rand(10 ** 17, 10 ** 18)), guild_id: G[i % 4].id, reason: pick(["fingerprint match", "ban evasion heuristic"]), created_at: now() - rand(3600, 2600000) })) }),
    "GET /api/exec/levels": ({ q }) => Array.from({ length: Math.min(25, Number(q.get("limit")) || 15) }, (_, i) => ({ guild_id: G[i % 4].id, user_id: String(445190237866231 + i * 449), level: 84 - i * 2, xp: 210000 - i * 7200 })),
    "GET /api/exec/invites": () => Array.from({ length: 10 }, (_, i) => ({ user_id: String(411998023311441 + i * 337), real: 340 - i * 29, bonus: rand(0, 40), fake: rand(0, 12), left: rand(0, 30) })),
    "GET /api/exec/giveaways": () => ({ active_giveaways: 2, total_entrants: 1487 }),
    "GET /api/exec/confessions": () => ({ total: 392 }),
    "GET /api/exec/logs/errors": ({ q }) => ({ lines: Array.from({ length: Math.min(1000, Number(q.get("lines")) || 50) }, (_, i) => `[2026-11-${String(20 - (i % 5)).padStart(2, "0")} 0${rand(0, 9)}:${rand(10, 59)}:12] ${pick(["ERROR cog economy: task exception was never retrieved", "WARNING gateway: shard 1 resumed after disconnect", "INFO web_server: exec client connected", "ERROR antinuke: rate limited while jailing raider"])} (line ${i + 1})`) }),
    "GET /api/exec/audit-log": ({ q }) => db.audit.slice(0, Math.min(500, Number(q.get("limit")) || 50)),
    "GET /api/exec/guilds": () => [...db.guilds].sort((a, b) => b.member_count - a.member_count),
    "GET /api/exec/guilds/": ({ path }) => {
      const g = guild(path.split("/")[4]);
      return { id: g.id, name: g.name, member_count: g.member_count, channel_count: g.channel_count, role_count: g.role_count, owner_id: g.owner_id, owner_name: nameFor(g.owner_id), boost_level: g.boost_level, boost_count: g.boost_count, created_at: g.created_at, joined_at: g.joined_at, features: ["COMMUNITY", "NEWS"], text_channels: Math.round(g.channel_count * 0.7), voice_channels: Math.round(g.channel_count * 0.2), categories: 6, emoji_count: 42, sticker_count: 5, verification_level: "medium", preferred_locale: "en-US", description: `${g.name} community`, vanity_url_code: g.name === "Rift HQ" ? "rift" : null };
    },
    "POST /api/exec/guilds/": ({ path }) => { const g = guild(path.split("/")[4]); db.guilds = db.guilds.filter((x) => x.id !== g.id); audit("demo_admin", "guild.leave", g.name); return { ok: true }; },
    "GET /api/exec/staff": () => db.staff,
    "GET /api/exec/permissions": () => ALL_PERMS,
    "POST /api/exec/staff": ({ body }) => { if (db.staff.some((s) => s.username === body.username)) bad("Username taken", 409); db.staff.push({ id: db.staff.length + 10, ...body, totp_enabled: false, last_login: null }); return { ok: true }; },
    "PATCH /api/exec/staff/": ({ path, body }) => { const s = db.staff.find((x) => x.id === Number(path.split("/")[4])) || bad("Not found", 404); const { password, ...rest } = body; Object.assign(s, rest); return { ok: true }; },
    "DELETE /api/exec/staff/": ({ path }) => { db.staff = db.staff.filter((s) => s.id !== Number(path.split("/")[4])); return { ok: true }; },
    "GET /api/exec/bot/cogs": () => db.ext.filter((e) => e.loaded).flatMap((e) => e.cogs),
    "GET /api/exec/bot/extensions": () => ({ extensions: db.ext }),
    "POST /api/exec/bot/cogs/": ({ path }) => {
      const [, , , , , , name, action] = path.split("/");
      const e = db.ext.find((x) => x.name === name) || bad(`Extension ${name} not found`, 404);
      if (e.protected) bad(`'${name}' hosts this API and can't be ${action}ed from it`, 400);
      if (action === "load" && e.loaded) bad(`${name} is already loaded`);
      if ((action === "unload" || action === "reload") && !e.loaded) bad(`${name} is not loaded`);
      if (action === "unload") e.loaded = false; else e.loaded = true;
      audit("demo_admin", `bot.${action}_cog`, name);
      return { status: `${name} ${action}ed on 2 shards` };
    },
    "GET /api/exec/bot/maintenance": () => db.maintenance,
    "POST /api/exec/bot/maintenance": ({ body }) => Object.assign(db.maintenance, { maintenance: !!body.maintenance, message: body.message || "" }),
    "POST /api/exec/bot/restart": () => ({ status: "restart signal sent" }),
    "POST /api/exec/bot/shutdown": () => ({ status: "shutdown signal sent" }),
    "POST /api/exec/broadcast": ({ body }) => { if (!body.message) bad("Message required"); return { sent: body.target === "all" ? 4 : 1, failed: 0 }; },
    "GET /api/exec/users/resolve": ({ q }) => Object.fromEntries(String(q.get("ids") || "").split(",").filter(Boolean).map((id) => [id, { username: nameFor(id), avatar: null }])),
    "GET /api/exec/members/search": ({ q }) => ({ members: NAMES.slice(0, 6).map((n, i) => ({ id: U[i % U.length], name: n, username: n, avatar: null })).filter((m) => m.name.includes((q.get("q") || "").toLowerCase())) }),
  };

  function find(method, path) {
    const exact = routes[`${method} ${path}`];
    if (exact) return exact;
    let best = null;
    for (const key of Object.keys(routes)) {
      const sp = key.indexOf(" ");
      if (key.slice(0, sp) !== method) continue;
      const rp = key.slice(sp + 1);
      if (path.startsWith(rp.endsWith("/") ? rp : `${rp}/`) && (!best || key.length > best.length)) best = key;
    }
    return best ? routes[best] : null;
  }

  /** Returns {status, data}. Never throws. */
  function handle(method, fullUrl, body, headers = {}) {
    const url = new URL(fullUrl, "http://mock.local");
    const auth = headers.Authorization || headers.authorization || "";
    const logged = method === "POST" && url.pathname === "/api/exec/login";
    const session = auth === "Bearer limited-token" ? { id: 2, username: "mira", role: "Support Lead", permissions: LIMITED } : auth === "Bearer demo-token" ? { id: 1, username: "demo_admin", role: "Founder", permissions: ["*"] } : null;
    if (!session && !logged && url.pathname.startsWith("/api/exec/")) return { status: 401, data: { error: "Unauthorized" } };
    const fn = find(method, url.pathname);
    if (!fn) return { status: 404, data: { error: `No such route: ${method} ${url.pathname}` } };
    try {
      return { status: 200, data: fn({ path: url.pathname, q: url.searchParams, body, session }) };
    } catch (e) {
      return { status: e.status || 500, data: { error: e.message } };
    }
  }

  return { db, handle, overview, routes };
}

export function installMockBackend(win = window) {
  if (win.__riftMockInstalled) return win.__riftMock;
  const mock = createMock();
  win.__riftMockInstalled = true;
  win.__riftMock = mock;
  const realFetch = win.fetch?.bind(win);
  win.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.includes("/api/")) return realFetch(input, init);
    await new Promise((r) => setTimeout(r, rand(40, 140)));
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    let body;
    try { body = init.body ? JSON.parse(init.body) : undefined; } catch { body = undefined; }
    const { status, data } = mock.handle(init.method || "GET", url, body, init.headers || {});
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  };
  class MockWebSocket {
    constructor(url) {
      this.url = String(url); this.readyState = 0;
      setTimeout(() => { this.readyState = 1; this.onopen?.(); this.timer = setInterval(() => {
        this.onmessage?.({ data: JSON.stringify({ type: "overview", data: mock.overview() }) });
      }, 3000); }, 120);
    }
    send() {}
    close() { clearInterval(this.timer); this.readyState = 3; this.onclose?.(); }
  }
  win.WebSocket = MockWebSocket;
  console.info("[rift-demo] mock backend active. Sign in as “demo” (or “mira” for limited access) with any password.");
  return mock;
}
