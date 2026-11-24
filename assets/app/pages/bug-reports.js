import { h, mount } from "../core/dom.js";
import { api, bugAttachmentUrl } from "../core/api.js";
import { pageHead, card, grid2, btn, select, badge, toast, asyncView, empty, toneFor } from "../ui/components.js";
import { barList, donut } from "../ui/charts.js";
import { userLabel, requestUsers } from "../core/resolve.js";
import { fmtDateTime, titleCase } from "../core/format.js";

export default function bugReports(ctx) {
  let filter = "open";
  const canManage = ctx.can("bugreports.manage");
  const stats = h("div"), listHost = h("div");
  const loadStats = () => api.listBugReports(undefined, { signal: ctx.signal }).then((all) => {
    all = Array.isArray(all) ? all : [];
    requestUsers(all.map((r) => r.reporter_user_id));
    if (!all.length) return mount(stats);
    const top = Object.entries(all.reduce((t, r) => { t[r.reporter_user_id] = (t[r.reporter_user_id] || 0) + 1; return t; }, {})).map(([id, value]) => ({ name: id, node: userLabel(id), value })).sort((a, b) => b.value - a.value);
    mount(stats, grid2(card("Reports by status", { sub: "Every report on file" }, donut(["open", "accepted", "rejected"].map((s) => ({ name: titleCase(s), value: all.filter((r) => r.status === s).length })), { centerLabel: "Reports", label: "Reports by status" })),
      card("Top reporters", null, barList(top.slice(0, 8), { label: "Top reporters" }))));
  }).catch(() => {});
  const list = () => mount(listHost, asyncView(ctx.signal, () => api.listBugReports(filter === "all" ? undefined : filter, { signal: ctx.signal }), (rows) => {
    rows = Array.isArray(rows) ? rows : [];
    requestUsers(rows.map((r) => r.reporter_user_id));
    if (!rows.length) return empty("No reports here.");
    const act = async (r, d) => { try { await api.resolveBugReport(r.id, d, { signal: ctx.signal }); toast(`Report ${d}`, "success"); list(); loadStats(); } catch (e) { if (e.name !== "AbortError") toast(e.message, "error"); } };
    return h("div", { class: "stack" }, rows.map((r) => card(null, null,
      h("div", { class: "between" }, h("span", null, "Reporter ", userLabel(r.reporter_user_id)), badge(r.status, toneFor(r.status))),
      h("p", { class: "pre" }, r.description),
      (r.attachments || []).length ? h("div", { class: "thumbs" }, r.attachments.map((a) => h("a", { href: bugAttachmentUrl(a.id), target: "_blank", rel: "noreferrer noopener" }, h("img", { src: bugAttachmentUrl(a.id), alt: "attachment", loading: "lazy", referrerpolicy: "no-referrer" })))) : null,
      h("p", { class: "muted small" }, fmtDateTime(r.created_at), r.reviewed_by_username ? ` · reviewed by ${r.reviewed_by_username}` : "", r.reward_granted ? " · 2,500 balance granted" : ""),
      canManage && r.status === "open" ? h("div", { class: "row" }, btn("Accept (+2,500 balance)", { variant: "success", onClick: () => act(r, "accepted") }), btn("Reject", { variant: "danger-ghost", onClick: () => act(r, "rejected") })) : null)));
  }, { rows: 3 }));
  const sel = select([["open", "Open"], ["accepted", "Accepted"], ["rejected", "Rejected"], ["all", "All"]], { value: filter, "aria-label": "Status filter", onChange: (e) => { filter = e.target.value; list(); } });
  loadStats(); list();
  return h("div", { class: "stack" }, pageHead("Bug Reports", { actions: sel }), stats, listHost);
}
