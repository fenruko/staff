/* Shared UI primitives. All text goes through h()/textContent. */
import { h, mount, isAbort, uid } from "../core/dom.js";
import { icon } from "./icons.js";

export const btn = (label, o = {}) => {
  const { variant, sm, onClick, icon: ic, type = "button", disabled, title } = o;
  return h("button", { type, class: ["btn", variant && `btn--${variant}`, sm && "btn--sm"], onClick, disabled, title, "aria-label": o.label },
    ic ? icon(ic, 14) : null, label);
};
export const badge = (text, tone = "neutral") => h("span", { class: `badge badge--${tone}` }, text);
export const pill = (text, tone) => h("span", { class: ["pill", tone && `pill--${tone}`] }, h("i", { class: "dot" }), text);

export function pageHead(title, { sub, actions } = {}) {
  return h("header", { class: "page-head" },
    h("div", null, h("h1", { class: "page-title" }, title), sub ? h("p", { class: "page-sub" }, sub) : null),
    actions ? h("div", { class: "page-actions" }, actions) : null);
}

export function card(title, opts, ...body) {
  const { sub, actions, class: cls } = opts && !(opts instanceof Node) && !Array.isArray(opts) ? opts : (body.unshift(opts), {});
  return h("section", { class: ["card", cls] },
    title || actions ? h("div", { class: "card-head" },
      h("div", null, title ? h("h2", { class: "card-title" }, title) : null, sub ? h("p", { class: "card-sub" }, sub) : null),
      actions ? h("div", { class: "card-actions" }, actions) : null) : null,
    ...body);
}

/** Stat tile: label, value, optional hint, tone, and sparkline node. */
export function stat({ label, value, hint, tone, spark, icon: ic }) {
  return h("div", { class: ["stat", tone && `stat--${tone}`] },
    h("div", { class: "stat-top" }, h("span", { class: "stat-label" }, label), ic ? icon(ic, 15) : null),
    h("div", { class: "stat-value" }, value ?? "—"),
    hint ? h("div", { class: "stat-hint" }, hint) : null,
    spark || null);
}
export const statGrid = (...tiles) => h("div", { class: "stat-grid" }, tiles);
export const grid2 = (...kids) => h("div", { class: "grid-2" }, kids);

export const skeleton = (rows = 3) => h("div", { class: "skel-wrap", role: "status", "aria-label": "Loading" }, Array.from({ length: rows }, () => h("div", { class: "skel" })), h("span", { class: "sr-only" }, "Loading…"));
export const empty = (text) => h("p", { class: "empty" }, text);

export function errorState(message, retry) {
  return h("div", { class: "error-state", role: "alert" },
    h("strong", null, "Something went wrong"), h("p", null, message || "Request failed."),
    retry ? btn("Try again", { sm: true, onClick: retry, ic: "refresh" }) : null);
}

/**
 * Section that fetches, shows a skeleton, then renders or shows an error with retry.
 * `render(data)` returns a Node/array. `refresh()` re-fetches quietly (keeps old content on failure).
 */
export function asyncView(signal, fetcher, render, { rows = 3 } = {}) {
  const root = h("div", { class: "async" });
  let first = true;
  const run = async (quiet = false) => {
    if (!quiet || first) mount(root, skeleton(rows));
    try {
      const data = await fetcher();
      if (signal?.aborted) return;
      first = false;
      mount(root, render(data));
      root.classList.remove("stale");
    } catch (e) {
      if (isAbort(e) || signal?.aborted) return;
      if (quiet && !first) { root.classList.add("stale"); return; }
      mount(root, errorState(e.message, () => run()));
    }
  };
  root.reload = () => run(false);
  root.refresh = () => run(true);
  run();
  return root;
}

export function field(label, control, help) {
  const id = uid("f");
  if (control.setAttribute && !control.id) control.id = id;
  return h("div", { class: "field" }, h("label", { class: "field-label", for: control.id || id }, label), control, help ? h("p", { class: "field-help" }, help) : null);
}
export const input = (o = {}) => h("input", { class: "input", ...o });
export const select = (options, o = {}) => {
  const { value, onChange, ...rest } = o;
  const el = h("select", { class: "select", onChange, ...rest }, options.map(([v, l]) => h("option", { value: v }, l)));
  if (value !== undefined) el.value = value;
  return el;
};

export function segmented(options, value, onChange, label = "Options") {
  const root = h("div", { class: "segmented", role: "group", "aria-label": label });
  const paint = (v) => root.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
  for (const [v, l] of options) root.append(h("button", { type: "button", dataset: { v }, onClick: () => { paint(v); onChange(v); } }, l));
  paint(value);
  root.set = paint;
  return root;
}

export function tabs(options, value, onChange) {
  const root = h("div", { class: "tabs", role: "tablist" });
  const paint = (v) => root.querySelectorAll("button").forEach((b) => { const on = b.dataset.v === v; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  for (const [v, l, count] of options) root.append(h("button", { type: "button", role: "tab", dataset: { v }, onClick: () => { paint(v); onChange(v); } }, l, count != null ? h("span", { class: "tab-count" }, count) : null));
  root.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const bs = [...root.querySelectorAll("button")];
    const i = bs.findIndex((b) => b.getAttribute("aria-selected") === "true");
    const n = bs[(i + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length];
    n.focus(); n.click();
  });
  paint(value);
  return root;
}

export function avatar(src, name = "") {
  if (src && /^https:\/\//.test(src)) return h("img", { class: "avatar", src, alt: "", width: 28, height: 28, loading: "lazy", referrerpolicy: "no-referrer" });
  return h("span", { class: "avatar avatar--fallback", "aria-hidden": "true" }, String(name).slice(0, 2).toUpperCase() || "?");
}

/* ---------- toasts ---------- */
export function toast(message, type = "info", ms = 4200) {
  let root = document.getElementById("toast-root");
  if (!root) { root = h("div", { id: "toast-root", class: "toast-root", role: "region", "aria-label": "Notifications", "aria-live": "polite" }); document.body.append(root); }
  const t = h("div", { class: `toast toast--${type}`, role: type === "error" ? "alert" : "status" }, h("span", null, message));
  root.append(t);
  while (root.children.length > 4) root.firstChild.remove();
  setTimeout(() => t.remove(), ms);
  return t;
}

/* ---------- modal / drawer ---------- */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function openModal(content, { title, drawer = false, onClose, wide = false, label } = {}) {
  const prev = document.activeElement;
  const titleId = uid("mt");
  const panel = h("div", { class: ["modal", drawer && "modal--drawer", wide && "modal--wide"], role: "dialog", "aria-modal": "true", "aria-labelledby": title ? titleId : null, "aria-label": title ? null : label, tabindex: "-1" },
    title ? h("div", { class: "modal-head" }, h("h2", { id: titleId, class: "card-title" }, title), h("button", { type: "button", class: "btn btn--ghost btn--icon", "aria-label": "Close", onClick: () => close() }, icon("close", 16))) : null,
    h("div", { class: "modal-body" }, content));
  const overlay = h("div", { class: "overlay", onMousedown: (e) => { if (e.target === overlay) close(); } }, panel);
  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
    document.body.classList.remove("no-scroll");
    try { prev?.focus?.(); } catch { /* gone */ }
    onClose?.(result);
  }
  function onKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab") return;
    const f = [...panel.querySelectorAll(FOCUSABLE)];
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener("keydown", onKey, true);
  document.body.append(overlay);
  document.body.classList.add("no-scroll");
  (panel.querySelector("[autofocus]") || panel.querySelector(FOCUSABLE) || panel).focus();
  return { close, panel, overlay };
}

/** Resolves true/false. If confirmWord is set the user must type it. */
export function confirmDialog({ title, description, confirmWord, confirmLabel = "Confirm", danger = true }) {
  return new Promise((resolve) => {
    const typed = confirmWord ? input({ autocomplete: "off", "aria-label": `Type ${confirmWord} to confirm`, autofocus: true }) : null;
    const ok = btn(confirmLabel, { variant: danger ? "danger" : "primary", disabled: !!confirmWord, onClick: () => m.close(true) });
    typed?.addEventListener("input", () => { ok.disabled = typed.value !== confirmWord; });
    typed?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !ok.disabled) m.close(true); });
    const m = openModal(h("div", { class: "stack" },
      description ? h("p", { class: "muted" }, description) : null,
      confirmWord ? h("div", { class: "field" }, h("label", { class: "field-label" }, "Type ", h("code", null, confirmWord), " to confirm"), typed) : null,
      h("div", { class: "row end" }, btn("Cancel", { variant: "ghost", onClick: () => m.close(false) }), ok)),
      { title, onClose: (r) => resolve(r === true) });
  });
}

/* ---------- misc ---------- */
export function copyText(text) {
  const done = () => toast("Copied to clipboard", "success", 1800);
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(done, () => toast("Copy failed", "error"));
  toast("Copy not available in this browser", "error");
}

export const kv = (pairs) => h("dl", { class: "kv" }, pairs.filter(Boolean).flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v ?? "—")]));
export const toneFor = (status) => ({ open: "warning", pending: "warning", claimed: "info", approved: "success", accepted: "success", applied: "success", resolved: "success", denied: "danger", rejected: "danger" }[String(status).toLowerCase()] || "neutral");
