import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, stat, statGrid, grid2, asyncView } from "../ui/components.js";
import { barList, stackedBars } from "../ui/charts.js";
import { dataTable } from "../ui/table.js";
import { userLabel, guildLabel, ensureGuilds, requestUsers, guildNameOf, userNameOf } from "../core/resolve.js";
import { fmtInt } from "../core/format.js";

// Each section loads, fails and renders on its own, so one failing endpoint
// never blanks the page and errors are visible instead of swallowed.
export default function leaderboards(ctx) {
  const sec = (perm, fetcher, render, rows = 3) => (ctx.can(perm) ? asyncView(ctx.signal, fetcher, render, { rows }) : null);
  const sections = [
    sec("giveaways.view", () => api.giveaways({ signal: ctx.signal }), (g) => statGrid(stat({ label: "Active giveaways", value: fmtInt(g.active_giveaways) }), stat({ label: "Total entrants", value: fmtInt(g.total_entrants) })), 1),
    sec("overview.view", () => api.confessions({ signal: ctx.signal }), (c) => statGrid(stat({ label: "Confessions posted", value: fmtInt(c.total) })), 1),
    sec("levels.view", async () => { const r = await api.levels(100, { signal: ctx.signal }); await ensureGuilds(); return r; }, (rows) => {
      rows = Array.isArray(rows) ? rows : [];
      requestUsers(rows.map((r) => r.user_id));
      return h("div", { class: "stack" },
        card("XP leaders", { sub: "Top accounts from the loaded level leaderboard" }, barList(rows.slice(0, 8).map((r) => ({ name: r.user_id, node: userLabel(r.user_id), value: Number(r.xp) || 0, hint: `level ${r.level}` })), { label: "XP leaders" })),
        card("Level leaderboard", null, dataTable({ rows, emptyLabel: "No level data.", columns: [
          { key: "guild_id", label: "Guild", render: (r) => guildLabel(r.guild_id), value: (r) => guildNameOf(r.guild_id) || r.guild_id },
          { key: "user_id", label: "User", render: (r) => userLabel(r.user_id), value: (r) => userNameOf(r.user_id) || r.user_id },
          { key: "level", label: "Level", align: "right" }, { key: "xp", label: "XP", align: "right", render: (r) => fmtInt(r.xp) }] })));
    }, 4),
    sec("invites.view", () => api.invites(100, { signal: ctx.signal }), (rows) => {
      rows = Array.isArray(rows) ? rows : [];
      requestUsers(rows.map((r) => r.user_id));
      return h("div", { class: "stack" },
        card("Invite breakdown", { sub: "Real, bonus, fake and left invites per member (top 8)" }, stackedBars(rows.slice(0, 8).map((r) => ({ ...r, name: r.user_id, node: userLabel(r.user_id) })), [{ key: "real", label: "Real" }, { key: "bonus", label: "Bonus" }, { key: "fake", label: "Fake" }, { key: "left", label: "Left" }], { label: "Invite breakdown" })),
        card("Invite leaderboard", null, dataTable({ rows, emptyLabel: "No invite data.", columns: [
          { key: "user_id", label: "User", render: (r) => userLabel(r.user_id), value: (r) => userNameOf(r.user_id) || r.user_id },
          ...["real", "bonus", "fake", "left"].map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), align: "right" }))] })));
    }, 4),
  ].filter(Boolean);
  return h("div", { class: "stack" }, pageHead("Leaderboards"), ...sections);
}
