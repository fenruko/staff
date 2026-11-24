import { h, mount } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, grid2, btn, input, select, field, asyncView, openModal, toast, avatar, badge, empty, confirmDialog } from "../ui/components.js";
import { barList, donut } from "../ui/charts.js";
import { memberInput } from "../ui/member-input.js";
import { userLabel, requestUsers } from "../core/resolve.js";
import { fmtAgo } from "../core/format.js";

const DURATIONS = [["permanent", "Permanent"], ["1h", "1 hour"], ["1d", "1 day"], ["3d", "3 days"], ["7d", "7 days"], ["30d", "30 days"]];

function history(ctx, userId) {
  const body = asyncView(ctx.signal, () => api.blacklistHistory(userId, { signal: ctx.signal }), (rows) => {
    rows = Array.isArray(rows) ? rows : [];
    return rows.length ? h("ul", { class: "plain" }, rows.map((r) => h("li", { class: "note" },
      h("div", { class: "between" }, h("strong", null, String(r.action || "").toUpperCase()), h("span", { class: "muted small" }, fmtAgo(r.created_at))),
      r.reason ? h("div", null, r.reason) : null, r.evidence ? h("div", { class: "muted small" }, `Evidence: ${r.evidence}`) : null,
      r.duration_label ? h("div", { class: "muted small" }, `Duration: ${r.duration_label}`) : null, r.staff_username ? h("div", { class: "muted small" }, `by ${r.staff_username}`) : null))) : empty("No history.");
  });
  openModal(body, { title: `History for ${userId}` });
}

export default function blacklist(ctx) {
  let busy = false;
  const picker = memberInput({ value: ctx.query.u || "", signal: ctx.signal, onChange: () => { lookup = null; lookupHost.replaceChildren(); } });
  let lookup = null;
  const lookupHost = h("div"), err = h("p", { class: "status-line bad", role: "alert" });
  const reason = input({ placeholder: "Reason", "aria-label": "Reason" }), evidence = input({ placeholder: "Evidence / context (optional)", "aria-label": "Evidence" });
  const duration = select(DURATIONS, { "aria-label": "Duration" });
  const addBtn = btn("Blacklist", { type: "submit", variant: "danger" });
  const listHost = h("div");

  async function runLookup() {
    const id = picker.get(); if (!id) return;
    err.textContent = "";
    try { lookup = await api.lookupBlacklistUser(id, { signal: ctx.signal });
      mount(lookupHost, h("div", { class: "who-row note" }, avatar(lookup.avatar, lookup.username), h("div", null, h("strong", null, lookup.username), lookup.already_blacklisted ? h("div", null, badge("Already blacklisted", "warning")) : null)));
      addBtn.disabled = !!lookup.already_blacklisted;
    } catch (e) { if (e.name !== "AbortError") err.textContent = e.message; }
  }
  const reloadList = () => mount(listHost, asyncView(ctx.signal, () => api.listBlacklist({ signal: ctx.signal }), (entries) => {
    entries = Array.isArray(entries) ? entries : [];
    requestUsers(entries.map((e) => e.user_id));
    const by = entries.reduce((t, e) => { const k = e.banned_by_username || "unknown"; t[k] = (t[k] || 0) + 1; return t; }, {});
    return h("div", { class: "stack" },
      entries.length ? grid2(card("Entry types", { sub: "Permanent vs timed" }, donut([{ name: "Permanent", value: entries.filter((e) => !e.duration_label).length }, { name: "Timed", value: entries.filter((e) => e.duration_label).length }], { centerLabel: "Entries", label: "Entry types" })),
        card("Added by", null, barList(Object.entries(by).map(([name, value]) => ({ name, value })), { label: "Added by" }))) : null,
      entries.length ? h("ul", { class: "plain" }, entries.map((e) => h("li", { class: "note between" },
        h("div", null, h("div", null, userLabel(e.user_id)), h("div", null, e.reason), e.evidence ? h("div", { class: "muted small" }, `Evidence: ${e.evidence}`) : null,
          h("div", { class: "muted small" }, `by ${e.banned_by_username} · ${fmtAgo(e.banned_at)}`, e.duration_label ? ` · expires ${e.duration_label} after ban time` : "")),
        h("div", { class: "row" }, btn("History", { sm: true, onClick: () => history(ctx, e.user_id) }), btn("Remove", { sm: true, variant: "danger-ghost", onClick: () => remove(e.user_id) }))))) : empty("Nobody is blacklisted."));
  }, { rows: 4 }));

  async function remove(id) {
    if (busy) return; busy = true;
    try { await api.removeBlacklist(id, { signal: ctx.signal }); toast("Removed from blacklist", "success"); }
    catch (e) { if (e.status !== 404 && e.name !== "AbortError") toast(e.message, "error"); } // 404: already removed
    finally { busy = false; reloadList(); }
  }
  async function add(e) {
    e.preventDefault();
    const id = picker.get();
    if (!id || busy) return;
    busy = true; err.textContent = "";
    try { await api.addBlacklist(id, reason.value.trim(), evidence.value.trim() || undefined, duration.value, { signal: ctx.signal });
      picker.set(""); reason.value = ""; evidence.value = ""; duration.value = "permanent"; lookupHost.replaceChildren(); toast("Blacklisted", "success"); reloadList(); }
    catch (x) { if (x.name !== "AbortError") err.textContent = x.message; } finally { busy = false; }
  }
  reloadList();
  return h("div", { class: "stack" }, pageHead("Bot Blacklist", { sub: "Users blocked from using Rift in any server. Separate from a per-server Discord ban." }),
    card(null, null, h("form", { class: "stack", onSubmit: add },
      h("div", { class: "row wrap grow" }, picker, btn("Look up", { onClick: runLookup }), duration), lookupHost, reason, evidence, h("div", null, addBtn), err)),
    listHost);
}
