import { h, mount } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, stat, statGrid, grid2, asyncView, btn, input, badge, segmented, select, toast, avatar, kv, empty } from "../ui/components.js";
import { barList, donut, stackedBars } from "../ui/charts.js";
import { dataTable } from "../ui/table.js";
import { memberInput } from "../ui/member-input.js";
import { userLabel, guildLabel, ensureGuilds, requestUsers, guildNameOf, userNameOf } from "../core/resolve.js";
import { fmtInt, titleCase, isSnowflake } from "../core/format.js";

const ACTIONS = [["warn", "Warn", "moderation.warn"], ["timeout", "Timeout (1h)", "moderation.timeout"], ["untimeout", "Remove timeout", "moderation.timeout"], ["kick", "Kick", "moderation.kick"], ["ban", "Ban", "moderation.ban"]];
export const RANGES = [["1", "24h"], ["7", "7d"], ["30", "30d"], ["90", "90d"]];

const who = (id) => (isSnowflake(id) ? userLabel(id) : h("span", { class: "who" }, String(id ?? "—")));

function lookupCard(ctx) {
  let profile = null;
  let guildId; // server chosen by staff; undefined = the bot's default match
  let subject = "";
  const out = h("div", { class: "stack" });
  const notice = h("p", { class: "status-line", role: "status" });
  const picker = memberInput({ signal: ctx.signal });
  const reason = input({ placeholder: "Reason", "aria-label": "Reason" });
  const say = (ok, t) => { notice.textContent = t; notice.className = `status-line ${ok ? "ok" : "bad"}`; };

  async function lookup(fresh = true) {
    const q = fresh ? picker.get() : subject;
    if (!q) return;
    if (fresh) { subject = q; guildId = undefined; }
    try { profile = await api.modUserLookup(q, guildId, { signal: ctx.signal }); guildId = profile.guild_id; notice.textContent = ""; draw(); }
    catch (e) { if (e.name === "AbortError") return; profile = null; say(false, e.message); mount(out); }
  }
  async function act(action) {
    try {
      const r = await api.modAction({ guild_id: profile.guild_id, action, target: profile.user.id, reason: reason.value.trim() || "No reason provided" }, { signal: ctx.signal });
      say(true, `${action}: ${r.status}`); reason.value = ""; lookup(false);
    } catch (e) { if (e.name !== "AbortError") say(false, e.message); }
  }
  function serverRow() {
    const list = profile.mutual_guilds || [];
    if (!list.length) return h("p", { class: "muted small" }, "Not in any server the bot shares.");
    const sel = select(list.map((g) => [g.id, g.name]), { value: String(profile.guild_id), "aria-label": "Server to moderate in", onChange: () => { guildId = sel.value; lookup(false); } });
    return h("div", { class: "field" }, h("label", { class: "field-label" }, `Moderate in (${list.length} shared server${list.length === 1 ? "" : "s"})`), sel);
  }
  function draw() {
    const u = profile.user;
    mount(out,
      h("div", { class: "who-row" }, avatar(u.avatar, u.name), h("div", null, h("strong", null, u.name), " ", h("span", { class: "muted" }, `@${u.username}`),
        h("div", { class: "muted small" }, `${profile.guild_name} · ${profile.warn_count} warns`, u.is_banned ? badge("banned", "danger") : null, u.timed_out ? badge("timed out", "warning") : null))),
      serverRow(),
      reason,
      h("div", { class: "row" }, ACTIONS.filter(([, , p]) => ctx.can(p)).map(([k, l]) => btn(l, { variant: k === "ban" || k === "kick" ? "danger" : "primary", onClick: () => act(k) }))),
      (profile.warnings || []).length ? h("div", null, h("h3", { class: "sub-title" }, "Recent warnings"), h("ul", { class: "plain" }, profile.warnings.slice(0, 5).map((w) => h("li", { class: "note" }, w.reason, h("span", { class: "muted" }, ` by ${w.moderator}`))))) : null);
  }
  picker.input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); lookup(); } });
  return card("User lookup & actions", null, h("div", { class: "stack" }, h("div", { class: "row grow" }, picker, btn("Look up", { variant: "primary", onClick: lookup })), notice, out));
}

export default function moderation(ctx) {
  let days = 7;
  const host = h("div");
  const load = () => mount(host, asyncView(ctx.signal, async () => { const d = await api.moderation(days, { signal: ctx.signal }); await ensureGuilds(); return d; }, (d) => {
    const ac = d.action_counts || {}, mods = d.top_moderators || [], recent = d.recent_actions || [], nuke = d.antinuke_logs || [];
    const warns = d.warnings || { total: 0, top_guilds: [] };
    requestUsers([...mods.map((m) => m.moderator_id), ...recent.flatMap((r) => [r.moderator_id, r.target_id]), ...nuke.map((n) => n.actor_id)]);
    const rangeLabel = RANGES.find(([v]) => v === String(days))[1];
    return h("div", { class: "stack" },
      statGrid(stat({ label: "Warnings", value: fmtInt(warns.total), hint: "All time" }),
        ...Object.entries(ac).slice(0, 5).map(([k, v]) => stat({ label: titleCase(k), value: fmtInt(v), hint: `Last ${rangeLabel}` }))),
      grid2(
        card("Actions by type", { sub: `Recorded actions in the last ${rangeLabel}` }, donut(Object.entries(ac).map(([k, v]) => ({ name: titleCase(k), value: Number(v) || 0 })), { centerLabel: "Actions", label: "Actions by type" })),
        card("Moderator workload", { sub: "All time, split by action type" }, stackedBars(mods.map((m) => ({ ...m, name: m.moderator_id, node: who(m.moderator_id) })), [{ key: "warns", label: "Warns" }, { key: "mutes", label: "Mutes" }, { key: "kicks", label: "Kicks" }, { key: "bans", label: "Bans" }], { label: "Moderator workload" }))),
      card("Warnings by guild", { sub: "All time" }, barList((warns.top_guilds || []).map((g) => ({ name: guildNameOf(g.guild_id) || g.guild_id, node: guildLabel(g.guild_id), value: Number(g.count) || 0 })), { label: "Warnings by guild" })),
      card("Top moderators", { sub: "All time" }, dataTable({ rows: mods, emptyLabel: "No moderator activity.", columns: [
        { key: "moderator_id", label: "Moderator", render: (r) => who(r.moderator_id), value: (r) => userNameOf(r.moderator_id) || r.moderator_id },
        ...["bans", "kicks", "mutes", "warns", "total"].map((k) => ({ key: k, label: titleCase(k), align: "right" }))] })),
      card("Recent actions", null, dataTable({ rows: recent, emptyLabel: "No recent actions.", columns: [
        { key: "action_type", label: "Action", render: (r) => badge(r.action_type, r.action_type === "ban" ? "danger" : r.action_type === "kick" ? "warning" : "info") },
        { key: "moderator_id", label: "Moderator", render: (r) => who(r.moderator_id), value: (r) => userNameOf(r.moderator_id) || r.moderator_id },
        { key: "target_id", label: "Target", render: (r) => who(r.target_id), value: (r) => userNameOf(r.target_id) || r.target_id },
        { key: "reason", label: "Reason" },
        { key: "guild_id", label: "Guild", render: (r) => guildLabel(r.guild_id), value: (r) => guildNameOf(r.guild_id) || r.guild_id }] })),
      card("Antinuke / antiraid triggers", null, dataTable({ rows: nuke, emptyLabel: "No triggers on record.", columns: [
        { key: "guild_id", label: "Guild", render: (r) => guildLabel(r.guild_id), value: (r) => guildNameOf(r.guild_id) || r.guild_id },
        { key: "actor_id", label: "Actor", render: (r) => who(r.actor_id) }, { key: "event_type", label: "Event" }, { key: "count", label: "Count", align: "right" }, { key: "punishment", label: "Punishment" }] })));
  }, { rows: 5 }));
  const range = segmented(RANGES, String(days), (v) => { days = Number(v); load(); }, "Time range");
  load();
  return h("div", { class: "stack" },
    pageHead("Moderation", { sub: "Warnings and moderator totals are all-time; action counts follow the range.", actions: range }),
    ctx.can("moderation.lookup") ? lookupCard(ctx) : null, host);
}
