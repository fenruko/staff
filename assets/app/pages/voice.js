import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, grid2, asyncView, pill } from "../ui/components.js";
import { barList } from "../ui/charts.js";
import { dataTable } from "../ui/table.js";
import { userLabel, guildLabel, ensureGuilds, requestUsers, guildNameOf, userNameOf } from "../core/resolve.js";
import { fmtInt } from "../core/format.js";

export default function voice(ctx) {
  const view = asyncView(ctx.signal, async () => { const d = await api.voice(100, { signal: ctx.signal }); await ensureGuilds(); return d; }, (d) => {
    const sessions = d.active_sessions || [], lb = d.voice_xp_leaderboard || [];
    requestUsers(lb.map((r) => r.user_id));
    const total = sessions.reduce((a, s) => a + (Number(s.listeners) || 0), 0);
    return h("div", { class: "stack" },
      grid2(
        card("Listeners per session", { sub: `${fmtInt(total)} listening across ${sessions.length} channel${sessions.length === 1 ? "" : "s"}` }, barList(sessions.map((s) => ({ name: `${s.channel} · ${s.guild_name}`, value: Number(s.listeners) || 0 })), { label: "Listeners per session", empty: "No active voice sessions right now." })),
        card("Top voice minutes", null, barList(lb.slice(0, 8).map((r) => ({ name: r.user_id, node: userLabel(r.user_id), value: Number(r.minutes) || 0 })), { label: "Top voice minutes" }))),
      card(`Active voice sessions (${sessions.length})`, { actions: pill("Auto-refreshing", "ok") }, dataTable({ rows: sessions, emptyLabel: "No active voice sessions right now.", columns: [{ key: "guild_name", label: "Guild" }, { key: "channel", label: "Channel" }, { key: "listeners", label: "Listeners", align: "right" }] })),
      card("Voice XP leaderboard", null, dataTable({ rows: lb, columns: [
        { key: "guild_id", label: "Guild", render: (r) => guildLabel(r.guild_id), value: (r) => guildNameOf(r.guild_id) || r.guild_id },
        { key: "user_id", label: "User", render: (r) => userLabel(r.user_id), value: (r) => userNameOf(r.user_id) || r.user_id },
        { key: "minutes", label: "Minutes", align: "right", render: (r) => fmtInt(r.minutes), value: (r) => Number(r.minutes) }] })));
  });
  // Live sessions: quiet refresh every 20s while the tab is visible.
  ctx.scope.interval(() => { if (!document.hidden) view.refresh(); }, 20000);
  return h("div", { class: "stack" }, pageHead("Voice"), view);
}
