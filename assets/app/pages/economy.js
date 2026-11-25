import { h, mount } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, stat, statGrid, grid2, asyncView, btn, input, toast, avatar, empty, errorState } from "../ui/components.js";
import { barList, donut } from "../ui/charts.js";
import { dataTable } from "../ui/table.js";
import { memberInput } from "../ui/member-input.js";
import { userLabel, guildLabel, ensureGuilds, requestUsers, guildNameOf, userNameOf } from "../core/resolve.js";
import { fmtInt, fmtSigned, fmtAgo, fmtCompact } from "../core/format.js";

const amountEl = (n) => h("span", { class: n >= 0 ? "pos" : "neg" }, fmtSigned(n));

function searchCard(ctx) {
  const picker = memberInput({ value: ctx.query.u || "", signal: ctx.signal });
  const out = h("div", { class: "stack" }), notice = h("p", { class: "status-line", role: "status" });
  const say = (ok, t) => { notice.textContent = t; notice.className = `status-line ${ok ? "ok" : "bad"}`; };
  let userId = "";
  async function search() {
    userId = picker.get();
    if (!userId) return;
    try { draw(await api.economySearch(userId, { signal: ctx.signal })); notice.textContent = ""; }
    catch (e) { if (e.name !== "AbortError") { mount(out); say(false, e.message); } }
  }
  function draw(r) {
    const amount = input({ type: "number", placeholder: "+/- amount", "aria-label": "Amount" }), reason = input({ placeholder: "Reason", "aria-label": "Reason" });
    const adj = h("form", { class: "row wrap", onSubmit: async (e) => {
      e.preventDefault();
      const n = parseInt(amount.value, 10);
      if (!n) return;
      try {
        const res = await api.economyAdjust({ user_id: userId, guild_id: "0", amount: n, reason: reason.value.trim() }, { signal: ctx.signal });
        say(true, res.status === "pending" ? "Amount exceeds the auto-approve threshold; sent to the approval inbox." : `Applied. New balance: ${fmtInt(res.balance_after)}`);
        amount.value = ""; reason.value = ""; search();
      } catch (err) { if (err.name !== "AbortError") say(false, err.message); }
    } }, amount, reason, btn("Adjust balance", { type: "submit", variant: "primary" }));
    const bal = r.balances?.[0];
    mount(out,
      h("div", { class: "who-row" }, avatar(r.avatar, r.username), h("strong", null, r.username || r.user_id)),
      bal ? h("div", { class: "big" }, fmtInt(bal.balance), h("small", { class: "muted" }, " balance")) : empty("No economy account for this user."),
      ctx.can("economy.manage") && bal ? adj : null,
      (r.adjustments || []).length ? h("div", null, h("h3", { class: "sub-title" }, "Recent adjustments"), h("ul", { class: "plain" }, r.adjustments.map((a) =>
        h("li", { class: "note between" }, h("span", null, amountEl(a.amount), " ", h("span", { class: "muted" }, a.reason)), h("span", { class: "muted small" }, `${a.status} · by ${a.staff_username} · ${fmtAgo(a.created_at)}`))))) : null);
  }
  picker.input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); search(); } });
  if (ctx.query.u) search();
  return card("Search a user", null, h("div", { class: "stack" }, h("div", { class: "row grow" }, picker, btn("Search", { variant: "primary", onClick: search })), notice, out));
}

function inboxCard(ctx) {
  const view = asyncView(ctx.signal, async () => { const items = await api.economyInbox("pending", { signal: ctx.signal }); await ensureGuilds(); return items; }, (items) => {
    items = Array.isArray(items) ? items : [];
    requestUsers(items.map((i) => i.user_id));
    if (!items.length) return empty("Nothing pending.");
    const resolve = async (id, decision, b) => {
      b.disabled = true;
      try { await api.economyInboxResolve(id, decision, { signal: ctx.signal }); toast(`Adjustment ${decision}`, "success"); view.reload(); }
      catch (e) { b.disabled = false; if (e.name !== "AbortError") toast(e.message, "error"); }
    };
    return h("ul", { class: "plain" }, items.map((a) => {
      const ap = btn("Approve", { sm: true, variant: "success" }), dn = btn("Deny", { sm: true, variant: "danger" });
      ap.addEventListener("click", () => resolve(a.id, "approved", ap)); dn.addEventListener("click", () => resolve(a.id, "denied", dn));
      return h("li", { class: "note between" },
        h("div", null, h("div", null, userLabel(a.user_id), " in ", guildLabel(a.guild_id), ": ", amountEl(a.amount)),
          h("div", { class: "muted small" }, `${a.reason} · requested by ${a.staff_username} · ${fmtAgo(a.created_at)}`)),
        h("div", { class: "row" }, ap, dn));
    }));
  }, { rows: 2 });
  return card("Adjustments awaiting approval", null, view);
}

export default function economy(ctx) {
  const view = asyncView(ctx.signal, async () => { const d = await api.economy(100, { signal: ctx.signal }); await ensureGuilds(); return d; }, (d) => {
    const t = d.totals || {}, lb = d.leaderboard || [];
    requestUsers(lb.map((r) => r.user_id));
    const byGuild = new Map();
    for (const r of lb) { const k = guildNameOf(r.guild_id) || r.guild_id; byGuild.set(k, (byGuild.get(k) || 0) + (Number(r.balance) || 0)); }
    return h("div", { class: "stack" },
      statGrid(stat({ label: "Accounts", value: fmtInt(t.total_accounts) }), stat({ label: "Total balance", value: fmtCompact(t.total_balance), hint: fmtInt(t.total_balance) }),
        stat({ label: "Average balance", value: fmtInt(t.average_balance) }), stat({ label: "Richest", value: fmtCompact(t.richest_balance), hint: fmtInt(t.richest_balance) })),
      grid2(card("Top balances", { sub: "Top 8 in the loaded leaderboard" }, barList(lb.slice(0, 8).map((r, i) => ({ name: `#${i + 1} ${r.user_id}`, node: h("span", null, `#${i + 1} `, userLabel(r.user_id)), value: Number(r.balance) || 0 })), { label: "Top balances", format: fmtCompact })),
        card("Balance by guild", { sub: "Share of the balances loaded here" }, donut([...byGuild].map(([name, value]) => ({ name, value })), { centerLabel: "Loaded", label: "Balance by guild", format: fmtCompact }))),
      ctx.can("economy.manage") ? searchCard(ctx) : null,
      ctx.can("economy.approve") ? inboxCard(ctx) : null,
      card(`Balance leaderboard (${lb.length})`, null, dataTable({ rows: lb.map((r, i) => ({ ...r, rank: i + 1 })), emptyLabel: "No accounts.", columns: [
        { key: "rank", label: "#", align: "right" },
        { key: "user_id", label: "User", render: (r) => userLabel(r.user_id), value: (r) => userNameOf(r.user_id) || r.user_id },
        { key: "guild_id", label: "Guild", render: (r) => guildLabel(r.guild_id), value: (r) => guildNameOf(r.guild_id) || r.guild_id },
        { key: "balance", label: "Balance", align: "right", render: (r) => fmtInt(r.balance), value: (r) => Number(r.balance) }] })));
  }, { rows: 4 });
  return h("div", { class: "stack" }, pageHead("Economy"), view);
}
