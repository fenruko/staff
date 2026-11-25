import { h, mount, debounce } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, stat, statGrid, asyncView, input, select, btn, openModal, confirmDialog, toast, kv, badge, avatar, errorState, skeleton } from "../ui/components.js";
import { barList } from "../ui/charts.js";
import { dataTable } from "../ui/table.js";
import { userLabel } from "../core/resolve.js";
import { fmtInt, fmtDate, fmtDateTime, titleCase } from "../core/format.js";

export default function guilds(ctx) {
  const canLeave = ctx.can("guilds.leave");
  let list = [], q = "", sortBy = "member_count";
  const host = h("div", { class: "stack" });
  const totals = h("div");
  const tableHost = h("div");
  const chartHost = h("div");

  function filtered() {
    const s = q.toLowerCase();
    return list.filter((g) => !s || String(g.name).toLowerCase().includes(s) || String(g.id).includes(s)).sort((a, b) => (sortBy === "name" ? String(a.name).localeCompare(String(b.name)) : (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0)));
  }

  function drawAll() {
    const rows = filtered();
    mount(totals, statGrid(
      stat({ label: "Guilds", value: fmtInt(rows.length), hint: rows.length !== list.length ? `of ${fmtInt(list.length)}` : null }),
      stat({ label: "Members", value: fmtInt(rows.reduce((a, g) => a + (Number(g.member_count) || 0), 0)) }),
      stat({ label: "Boosts", value: fmtInt(rows.reduce((a, g) => a + (Number(g.boost_count) || 0), 0)), hint: `${rows.filter((g) => g.boost_level > 0).length} boosted guilds` }),
      stat({ label: "Channels", value: fmtInt(rows.reduce((a, g) => a + (Number(g.channel_count) || 0), 0)) })));
    mount(chartHost, barList(rows.slice(0, 10).map((g) => ({ name: g.name, value: Number(g.member_count) || 0 })), { label: "Members by guild" }));
    const cols = [
      { key: "name", label: "Guild", render: (g) => h("span", { class: "who-row" }, avatar(g.icon, g.name), h("span", null, h("strong", null, g.name), h("small", { class: "muted block" }, g.id))) },
      { key: "member_count", label: "Members", align: "right", render: (g) => fmtInt(g.member_count), value: (g) => Number(g.member_count) },
      { key: "channel_count", label: "Channels", align: "right", render: (g) => (g.channel_count == null ? "—" : fmtInt(g.channel_count)), value: (g) => Number(g.channel_count) },
      { key: "role_count", label: "Roles", align: "right", render: (g) => (g.role_count == null ? "—" : fmtInt(g.role_count)), value: (g) => Number(g.role_count) },
      { key: "boost_count", label: "Boosts", align: "right", render: (g) => `L${g.boost_level ?? 0} · ${g.boost_count ?? 0}`, value: (g) => Number(g.boost_count) },
      { key: "shard_id", label: "Shard", align: "right", render: (g) => g.shard_id ?? "—" },
      { key: "joined_at", label: "Joined", render: (g) => fmtDate(g.joined_at), value: (g) => Date.parse(g.joined_at) || 0 },
      { key: "created_at", label: "Created", render: (g) => fmtDate(g.created_at), value: (g) => Date.parse(g.created_at) || 0 },
    ];
    if (canLeave) cols.push({ key: "_leave", label: "", sortable: false, align: "right", render: (g) => btn("Leave", { sm: true, variant: "danger-ghost", onClick: (e) => { e.stopPropagation(); leave(g); } }) });
    mount(tableHost, dataTable({ rows, columns: cols, emptyLabel: "No guilds match.", onRow: openDetail, caption: "Guilds" }));
  }

  async function leave(g) {
    const ok = await confirmDialog({ title: `Leave ${g.name}?`, description: "The bot will immediately leave this server. It can be re-invited later, but live state (voice sessions, active tickets) will be lost.", confirmWord: g.name, confirmLabel: "Leave server" });
    if (!ok) return;
    try { await api.leaveGuild(g.id); toast(`Left ${g.name}`, "success"); await load(); } catch (e) { toast(e.message, "error"); }
  }

  function openDetail(g) {
    const body = h("div", null, skeleton(5));
    const m = openModal(body, { title: g.name, drawer: true });
    api.guildDetail(g.id, { signal: ctx.signal }).then((d) => {
      mount(body, h("div", { class: "stack" },
        d.description ? h("p", { class: "muted" }, d.description) : null,
        statGrid(stat({ label: "Members", value: fmtInt(d.member_count) }), stat({ label: "Channels", value: fmtInt(d.channel_count) }), stat({ label: "Roles", value: fmtInt(d.role_count) }), stat({ label: "Boosts", value: fmtInt(d.boost_count), hint: `Level ${d.boost_level ?? 0}` })),
        kv([
          ["ID", h("code", null, d.id)], ["Owner", d.owner_name ? h("span", null, d.owner_name, " ", h("small", { class: "muted" }, d.owner_id)) : userLabel(d.owner_id)],
          ["Created", fmtDateTime(d.created_at)], ["Bot joined", fmtDateTime(d.joined_at)],
          ["Text channels", fmtInt(d.text_channels)], ["Voice channels", fmtInt(d.voice_channels)], ["Categories", fmtInt(d.categories)],
          ["Emoji / stickers", `${fmtInt(d.emoji_count)} / ${fmtInt(d.sticker_count)}`], ["Verification", titleCase(d.verification_level)], ["Locale", d.preferred_locale],
          d.vanity_url_code ? ["Vanity URL", `discord.gg/${d.vanity_url_code}`] : null]),
        (d.features || []).length ? h("div", { class: "chips" }, d.features.map((f) => badge(titleCase(f.toLowerCase()), "info"))) : null,
        canLeave ? h("div", { class: "row end" }, btn("Leave server", { variant: "danger", onClick: () => { m.close(); leave(g); } })) : null));
    }).catch((e) => { if (e.name !== "AbortError") mount(body, errorState(e.message)); });
  }

  async function load() {
    list = await api.guilds({ signal: ctx.signal });
    if (!Array.isArray(list)) list = [];
    drawAll();
  }

  const search = debounce((v) => { q = v.trim(); drawAll(); }, 150);
  const view = asyncView(ctx.signal, () => load(), () => h("div", { class: "stack" }, totals, card("Members by guild", null, chartHost), card("All guilds", { actions: h("div", { class: "toolbar" },
    select([["member_count", "Sort: members"], ["name", "Sort: name"], ["boost_count", "Sort: boosts"], ["channel_count", "Sort: channels"]], { "aria-label": "Sort guilds", onChange: (e) => { sortBy = e.target.value; drawAll(); } }),
    input({ type: "search", placeholder: "Search by name or ID…", "aria-label": "Search guilds", onInput: (e) => search(e.target.value) })) }, tableHost)));
  ctx.scope.add(() => search.cancel());
  return h("div", { class: "stack" }, pageHead("Guilds"), view);
}
