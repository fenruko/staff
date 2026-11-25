/* Command palette (Ctrl/Cmd+K), shortcuts help and the guide. Loaded on first use. */
import { h, uid } from "../core/dom.js";
import { openModal } from "./components.js";
import { icon } from "./icons.js";

export function openPalette({ items, onPick }) {
  let q = "", idx = 0, shown = items;
  const listId = uid("pl");
  const input = h("input", { class: "input palette-input", placeholder: "Jump to a page…", role: "combobox", "aria-expanded": "true", "aria-controls": listId, "aria-label": "Command palette", autocomplete: "off", autofocus: true });
  const list = h("ul", { class: "palette-list", id: listId, role: "listbox" });
  const paint = () => {
    list.replaceChildren(...shown.map((it, i) => h("li", { role: "option", "aria-selected": String(i === idx), class: i === idx && "active", onMousedown: (e) => { e.preventDefault(); pick(it); } },
      icon(it.icon || "overview", 16), h("span", null, it.label), it.hint ? h("kbd", null, it.hint) : null)));
    if (!shown.length) list.append(h("li", { class: "empty" }, "No matching pages."));
  };
  const pick = (it) => { m.close(); onPick(it); };
  input.addEventListener("input", () => {
    q = input.value.trim().toLowerCase();
    shown = items.filter((i) => i.label.toLowerCase().includes(q));
    idx = 0; paint();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(shown.length - 1, idx + 1); paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); paint(); }
    else if (e.key === "Enter" && shown[idx]) { e.preventDefault(); pick(shown[idx]); }
  });
  paint();
  const m = openModal(h("div", null, input, list), { label: "Command palette" });
  m.panel.classList.add("palette");
  return m;
}

export function openShortcuts(items) {
  return openModal(h("div", { class: "stack" },
    h("dl", { class: "kv" },
      h("dt", null, h("kbd", null, "Ctrl"), " + ", h("kbd", null, "K")), h("dd", null, "Command palette"),
      h("dt", null, h("kbd", null, "?")), h("dd", null, "This help"),
      h("dt", null, h("kbd", null, "/")), h("dd", null, "Focus the user ID lookup"),
      h("dt", null, h("kbd", null, "Esc")), h("dd", null, "Close dialogs")),
    h("h3", { class: "sub-title" }, "Go to (press g, then…)"),
    h("dl", { class: "kv" }, items.flatMap((i) => [h("dt", null, h("kbd", null, "g"), " ", h("kbd", null, i.key)), h("dd", null, i.label)]))), { title: "Keyboard shortcuts" });
}

const GUIDE = [
  ["Getting oriented", ["The sidebar lists every page you have permission for.", "Press Ctrl/Cmd+K to jump anywhere, or ? for all shortcuts.", "A green Live pill means the page updates in real time."]],
  ["Handling a ban appeal", ["Go to Ban Appeals. New ones land in the Open tab.", "Open an appeal to see the reason, evidence, and whether the user is actually blacklisted; a yellow warning means they may be trolling.", "Claim it so other staff know you're handling it.", "Use the quick-reply dropdown or type your own message, then Approve or Deny.", "The user is DMed automatically and can reply from their private thread link; you'll see replies live."]],
  ["Managing the blacklist", ["The Blacklist page lists everyone blocked from using Rift bot-wide (not a single server's ban).", "Add someone with their Discord ID and a reason, or blacklist straight from an appeal.", "Remove someone to restore their access instantly."]],
  ["Day-to-day moderation", ["Moderation lets you look up a user: warnings, history, ban status.", "Tickets & Reports shows what users flagged inside servers.", "Bot Control handles extension reloads, maintenance mode and restarts."]],
];
export function openGuide() {
  let active = 0;
  const side = h("div", { class: "guide-side", role: "tablist" });
  const body = h("div", { class: "guide-body" });
  const paint = () => {
    side.replaceChildren(...GUIDE.map(([t], i) => h("button", { type: "button", role: "tab", "aria-selected": String(i === active), class: i === active && "active", onClick: () => { active = i; paint(); } }, t)));
    body.replaceChildren(h("h3", { class: "sub-title" }, GUIDE[active][0]), h("ol", { class: "steps" }, GUIDE[active][1].map((s) => h("li", null, s))));
  };
  paint();
  return openModal(h("div", { class: "guide" }, side, body), { title: "Guide", wide: true });
}
