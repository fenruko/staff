import { h, mount } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, grid2, asyncView, select, input } from "../ui/components.js";
import { barList, donut } from "../ui/charts.js";
import { dataTable } from "../ui/table.js";
import { userLabel, guildLabel, ensureGuilds, requestUsers, guildNameOf, userNameOf } from "../core/resolve.js";
import { fmtDateTime } from "../core/format.js";

export default function verification(ctx) {
  return h("div", { class: "stack" }, pageHead("Verification", { sub: "Ban-evasion and fingerprint match flags across all guilds." }),
    asyncView(ctx.signal, async () => {
      const d = await api.verification(200, { signal: ctx.signal });
      await ensureGuilds();
      return d;
    }, (d) => {
      const flags = d.flags || [];
      requestUsers(flags.flatMap((f) => [f.user_id, f.matched_user_id]));
      const count = (fn) => Object.entries(flags.reduce((t, f) => { const k = fn(f); t[k] = (t[k] || 0) + 1; return t; }, {}));
      const reasons = [...new Set(flags.map((f) => f.reason || "unknown"))];
      const guildIds = [...new Set(flags.map((f) => String(f.guild_id)))];
      let reason = "", guild = "", q = "";
      const table = dataTable({
        emptyLabel: "No verification flags match.",
        initialSort: { key: "when", dir: -1 },
        columns: [
          { key: "user_id", label: "User", render: (r) => userLabel(r.user_id), value: (r) => userNameOf(r.user_id) || r.user_id },
          { key: "matched_user_id", label: "Matched account", render: (r) => userLabel(r.matched_user_id), value: (r) => userNameOf(r.matched_user_id) || r.matched_user_id },
          { key: "guild_id", label: "Guild", render: (r) => guildLabel(r.guild_id), value: (r) => guildNameOf(r.guild_id) || r.guild_id },
          { key: "reason", label: "Reason" },
          { key: "when", label: "When", value: (r) => r.timestamp ?? r.created_at, render: (r) => fmtDateTime(r.timestamp ?? r.created_at) },
        ],
      });
      const apply = () => table.setRows(flags.filter((f) => (!reason || (f.reason || "unknown") === reason) && (!guild || String(f.guild_id) === guild)
        && (!q || [f.user_id, f.matched_user_id, userNameOf(f.user_id), userNameOf(f.matched_user_id)].some((x) => String(x ?? "").toLowerCase().includes(q)))));
      apply();
      const filters = h("div", { class: "toolbar" },
        select([["", "All reasons"], ...reasons.map((r) => [r, r])], { "aria-label": "Filter by reason", onChange: (e) => { reason = e.target.value; apply(); } }),
        select([["", "All guilds"], ...guildIds.map((g) => [g, guildNameOf(g) || g])], { "aria-label": "Filter by guild", onChange: (e) => { guild = e.target.value; apply(); } }),
        input({ type: "search", placeholder: "Filter by user id or name…", "aria-label": "Filter by user", onInput: (e) => { q = e.target.value.trim().toLowerCase(); apply(); } }));
      return h("div", { class: "stack" },
        grid2(card("Flags by reason", null, donut(count((f) => f.reason || "unknown").map(([name, value]) => ({ name, value })), { centerLabel: "Flags", label: "Flags by reason" })),
          card("Flags by guild", null, barList(count((f) => guildNameOf(f.guild_id) || f.guild_id).map(([name, value]) => ({ name, value })), { label: "Flags by guild" }))),
        card(`Flags (${flags.length})`, { actions: filters }, table));
    }));
}
