/* Text input that accepts a raw Discord ID but offers username autocomplete. */
import { h, debounce, uid } from "../core/dom.js";
import { api } from "../core/api.js";
import { avatar } from "./components.js";

export function memberInput({ placeholder = "Discord ID or username", value = "", onChange, signal } = {}) {
  const listId = uid("ms");
  const input = h("input", { class: "input", placeholder, value, autocomplete: "off", role: "combobox", "aria-expanded": "false", "aria-controls": listId, "aria-autocomplete": "list" });
  const list = h("ul", { class: "suggest", id: listId, role: "listbox", hidden: true });
  const root = h("div", { class: "member-input" }, input, list);
  let items = [], active = -1, seq = 0;

  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const choose = (m) => { input.value = m.id; onChange?.(m.id); close(); };
  const paint = () => {
    list.replaceChildren(...items.map((m, i) => h("li", { role: "option", "aria-selected": String(i === active), class: i === active && "active", onMousedown: (e) => { e.preventDefault(); choose(m); } },
      avatar(m.avatar, m.name), h("span", null, m.name), h("small", { class: "muted" }, `@${m.username}`))));
    list.hidden = !items.length;
    input.setAttribute("aria-expanded", String(!!items.length));
  };
  const search = debounce(async (q) => {
    const mine = ++seq;
    try {
      const res = await api.searchMembers(q, { signal });
      if (mine !== seq) return;
      items = (res?.members || []).slice(0, 8);
      active = -1;
      paint();
    } catch { items = []; paint(); }
  }, 250);

  input.addEventListener("input", () => {
    const v = input.value.trim();
    onChange?.(input.value);
    if (!v || /^\d+$/.test(v)) { seq++; items = []; paint(); return; }
    search(v);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && items.length) { e.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(items[active]); }
    else if (e.key === "Escape" && !list.hidden) { e.stopPropagation(); close(); }
  });
  input.addEventListener("blur", () => setTimeout(close, 120));
  root.input = input;
  root.get = () => input.value.trim();
  root.set = (v) => { input.value = v; onChange?.(v); };
  return root;
}
