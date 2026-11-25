/* Route table. Page code is imported on demand, only after the permission gate passes. */

const BOT = ["bot.control", "bot.restart", "bot.shutdown", "broadcast.send"];

export const ROUTES = [
  { path: "/", id: "overview", label: "Overview", icon: "overview", group: "Monitor", perm: "overview.view", key: "o", load: () => import("./pages/overview.js") },
  { path: "/economy", id: "economy", label: "Economy", icon: "economy", group: "Community", perm: "economy.view", key: "e", load: () => import("./pages/economy.js") },
  { path: "/moderation", id: "moderation", label: "Moderation", icon: "shield", group: "Community", perm: "moderation.view", key: "m", load: () => import("./pages/moderation.js") },
  { path: "/tickets", id: "tickets", label: "Tickets & Reports", icon: "tickets", group: "Community", perm: "tickets.view", key: "t", load: () => import("./pages/tickets.js") },
  { path: "/appeals", id: "appeals", label: "Ban Appeals", icon: "message", group: "Community", perm: "appeals.view", key: "a", load: () => import("./pages/appeals.js") },
  { path: "/bugreports", id: "bugreports", label: "Bug Reports", icon: "bug", group: "Community", perm: "bugreports.view", key: "b", load: () => import("./pages/bug-reports.js") },
  { path: "/blacklist", id: "blacklist", label: "Blacklist", icon: "ban", group: "Community", perm: "blacklist.manage", key: "k", load: () => import("./pages/blacklist.js") },
  { path: "/voice", id: "voice", label: "Voice", icon: "voice", group: "Analytics", perm: "voice.view", key: "v", load: () => import("./pages/voice.js") },
  { path: "/verification", id: "verification", label: "Verification", icon: "verify", group: "Analytics", perm: "verification.view", key: "f", load: () => import("./pages/verification.js") },
  { path: "/leaderboards", id: "leaderboards", label: "Leaderboards", icon: "trophy", group: "Analytics", perm: ["levels.view", "invites.view", "giveaways.view"], key: "l", load: () => import("./pages/leaderboards.js") },
  { path: "/guilds", id: "guilds", label: "Guilds", icon: "guilds", group: "Bot", perm: "guilds.view", key: "u", load: () => import("./pages/guilds.js") },
  { path: "/logs", id: "logs", label: "Logs & Audit", icon: "logs", group: "Bot", perm: ["logs.view", "audit.view"], key: "x", load: () => import("./pages/logs.js") },
  { path: "/bot-control", id: "bot-control", label: "Bot Control", icon: "control", group: "Bot", perm: BOT, key: "c", load: () => import("./pages/bot-control.js") },
  { path: "/staff", id: "staff", label: "Staff Management", icon: "users", group: "Admin", perm: "staff.manage", key: "s", load: () => import("./pages/staff.js") },
  { path: "/login", id: "login", public: true, load: () => import("./pages/login.js") },
  { path: "/appeal/:token", id: "legacy-appeal", public: true, legacyAppeal: true },
  { path: "*", id: "404", notFound: true },
];

export const NAV = ROUTES.filter((r) => r.label);
