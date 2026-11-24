import { h, mount } from "../core/dom.js";
import { api, attachmentUrl } from "../core/api.js";
import { connectExecSocket } from "../core/ws.js";
import { pageHead, card, tabs, btn, input, badge, pill, avatar, openModal, toast, asyncView, empty, toneFor, skeleton, errorState } from "../ui/components.js";
import { barList } from "../ui/charts.js";
import { fmtAgo } from "../core/format.js";

const TABS = [["open", "Open"], ["claimed", "Claimed"], ["approved", "Approved"], ["denied", "Denied"]];
const CANNED = [
  "Thanks for the additional info -- taking a closer look now.", "Could you clarify what happened leading up to this?",
  "We've reviewed your appeal and need a bit more evidence before deciding.", "This has been approved -- you should have access again shortly.", "After review, we're not able to approve this appeal.",
];
const BUCKETS = [["Under 1h", 3600], ["1-24h", 86400], ["1-7d", 604800], ["Over 7d", Infinity]];
export function ageBuckets(appeals, now = Date.now() / 1000) {
  const rows = BUCKETS.map(([name]) => ({ name, value: 0 }));
  for (const a of appeals) {
    const age = Math.max(0, now - (Number(a.created_at) || now));
    rows[Math.max(0, BUCKETS.findIndex(([, max]) => age < max))].value += 1;
  }
  return rows;
}
const toDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
const thumbs = (ids, alt) => (ids?.length ? h("div", { class: "thumbs" }, ids.map((id) => h("a", { href: attachmentUrl(id), target: "_blank", rel: "noreferrer noopener" }, h("img", { src: attachmentUrl(id), alt, loading: "lazy", referrerpolicy: "no-referrer" })))) : null);

export default function appeals(ctx) {
  let tab = "open", selectedId = null, detail = null;
  const listHost = h("div"), liveEl = pill("Connecting…");
  const canManage = ctx.can("appeals.manage"), canBl = ctx.can("blacklist.manage");

  const list = () => mount(listHost, asyncView(ctx.signal, () => api.listAppeals(tab, { signal: ctx.signal }), (rows) => {
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) return empty("No appeals in this view.");
    return h("div", { class: "stack" },
      card("Backlog by age", { sub: `${rows.length} appeal${rows.length === 1 ? "" : "s"} in this view` }, barList(ageBuckets(rows), { label: "Backlog by age" })),
      h("ul", { class: "plain appeal-list" }, rows.map((a) => h("li", null, h("button", { type: "button", class: "appeal-item", onClick: () => open(a.id) },
        avatar(a.avatar_snapshot, a.username_snapshot), h("span", { class: "grow" },
          h("span", { class: "between" }, h("strong", null, a.username_snapshot || `Appeal #${a.id}`), h("span", { class: "muted small" }, fmtAgo(a.created_at))),
          h("span", { class: "clamp muted" }, a.reason),
          h("span", { class: "row small" }, a.claimed_by_username ? h("span", { class: "muted" }, `Claimed by ${a.claimed_by_username}`) : null, a.likely_troll ? badge("not blacklisted", "warning") : null)))))));
  }, { rows: 4 }));

  async function open(id) {
    selectedId = id;
    try { detail = await api.getAppeal(id, { signal: ctx.signal }); show(); } catch (e) { if (e.name !== "AbortError") toast(e.message, "error"); }
  }
  let modal = null;
  function show() {
    if (modal) modal.close();
    modal = openModal(detailView(detail), { title: detail.username_snapshot || `Appeal #${detail.id}`, wide: true, onClose: () => { modal = null; selectedId = null; } });
  }
  const refreshDetail = async () => { list(); if (selectedId) { detail = await api.getAppeal(selectedId, { signal: ctx.signal }); show(); } };

  function detailView(a) {
    let images = [], busy = false;
    const note = input({ placeholder: "Reply to the user… (paste or attach a screenshot)", "aria-label": "Reply" });
    const thumbHost = h("div", { class: "thumbs" });
    const err = h("p", { class: "status-line bad", role: "alert" });
    const bl = a.blacklist_status;
    const mine = a.claimed_by_username === ctx.user?.username;
    const run = async (fn) => { if (busy) return; busy = true; err.textContent = ""; try { await fn(); await refreshDetail(); } catch (e) { if (e.name !== "AbortError") err.textContent = e.message; } finally { busy = false; } };
    const addImage = async (file) => {
      if (!file) return;
      try { const url = await toDataUrl(file); const { id } = await api.uploadExecAppealImage(a.id, url, { signal: ctx.signal }); images.push({ id, url }); thumbHost.append(h("img", { src: url, alt: "pending attachment" })); }
      catch (e) { err.textContent = e.message; }
    };
    note.addEventListener("paste", (e) => { const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/")); if (it) { e.preventDefault(); addImage(it.getAsFile()); } });
    const quick = h("select", { class: "select", "aria-label": "Quick reply", onChange: (e) => { if (e.target.value) note.value = e.target.value; e.target.value = ""; } }, h("option", { value: "" }, "Quick reply…"), CANNED.map((c) => h("option", { value: c }, `${c.slice(0, 40)}…`)));
    const fileIn = h("input", { type: "file", accept: "image/*", hidden: true, onChange: (e) => { addImage(e.target.files?.[0]); e.target.value = ""; } });
    const closed = a.status === "approved" || a.status === "denied";
    const resolve = (d) => btn(d === "approved" ? "Approve" : "Deny", { variant: d === "approved" ? "success" : "danger", onClick: () => run(() => api.resolveAppeal(a.id, d, note.value, { signal: ctx.signal })) });
    const blReason = input({ placeholder: "Blacklist reason…", "aria-label": "Blacklist reason" });
    return h("div", { class: "stack" },
      h("p", { class: "muted small" }, `User ${a.user_id} · ${fmtAgo(a.created_at)} · `, badge(a.status, toneFor(a.status)), a.claimed_by_username ? ` claimed by ${a.claimed_by_username}` : ""),
      bl ? h("div", { class: ["callout", bl.blacklisted ? "callout--ok" : "callout--warn"] }, bl.blacklisted ? ["Confirmed blacklisted by ", h("strong", null, bl.banned_by_username), `: ${bl.reason ?? ""}`] : ["This user is ", h("strong", null, "not currently blacklisted"), "; this may be a mistaken or trolling submission."]) : null,
      h("p", { class: "pre" }, a.reason), a.evidence ? h("p", { class: "pre muted" }, `Evidence: ${a.evidence}`) : null, thumbs(a.evidence_attachment_ids, "evidence"),
      h("div", { class: "thread" }, (a.messages || []).map((m) => h("div", { class: ["msg", m.is_staff && "msg--staff"] }, h("p", { class: "pre" }, m.text), thumbs(m.attachment_ids, "attachment")))),
      canManage && !closed ? h("div", { class: "stack" },
        a.status === "open" ? btn("Claim this appeal", { variant: "primary", onClick: () => run(() => api.claimAppeal(a.id, { signal: ctx.signal })) }) : null,
        a.status === "claimed" && mine ? h("div", { class: "stack" }, h("div", { class: "row wrap grow" }, quick, note, btn("", { ic: "paperclip", title: "Attach image", onClick: () => fileIn.click() }), fileIn,
          btn("Send", { onClick: () => run(async () => { if (!note.value.trim() && !images.length) return; await api.messageAppeal(a.id, note.value, images.map((i) => i.id), { signal: ctx.signal }); note.value = ""; images = []; thumbHost.replaceChildren(); }) })), thumbHost,
          h("div", { class: "row" }, resolve("approved"), resolve("denied"), btn("Unclaim", { variant: "ghost", onClick: () => run(() => api.unclaimAppeal(a.id, { signal: ctx.signal })) }))) : null) : null,
      a.status === "approved" ? h("p", { class: "callout callout--ok" }, "Approved. This doesn't lift the ban automatically; do that from the Moderation page.") : null,
      canBl ? h("div", { class: "row wrap grow topline" }, bl?.blacklisted ? btn("Remove from blacklist", { variant: "ghost", onClick: () => run(() => api.unblacklistFromAppeal(a.id, { signal: ctx.signal })) })
        : [blReason, btn("Blacklist instead", { variant: "danger-ghost", onClick: () => { if (blReason.value.trim()) run(() => api.blacklistFromAppeal(a.id, blReason.value.trim(), { signal: ctx.signal })); } })]) : null,
      err);
  }

  const tabBar = tabs(TABS, tab, (t) => { tab = t; list(); });
  // Any appeal_* event means "something changed": refetch rather than trusting the partial payload.
  ctx.scope.add(connectExecSocket((msg) => {
    if (!msg.type?.startsWith("appeal_")) return;
    list();
    if (selectedId && msg.id === selectedId) api.getAppeal(selectedId, { signal: ctx.signal }).then((d) => { detail = d; show(); }).catch(() => {});
  }, (s) => { liveEl.className = `pill ${s === "connected" ? "pill--ok" : ""}`; liveEl.lastChild.textContent = s === "connected" ? "Live" : "Connecting…"; }));
  ctx.scope.add(() => modal?.close());
  list();
  return h("div", { class: "stack" }, pageHead("Ban Appeals", { actions: liveEl }), tabBar, listHost);
}
