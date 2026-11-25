/* Sortable table. Rows beyond 200 are paginated (100/page) so the DOM stays small. */
import { h } from "../core/dom.js";
import { paginate, sortRows } from "../core/format.js";
import { empty } from "./components.js";

export const PAGE_AT = 200;
export const PAGE_SIZE = 100;

/**
 * columns: [{key, label, render?(row), value?(row) for sort/filter, align?, sortable?=true, class?}]
 * Returns a node with setRows(rows).
 */
export function dataTable({ columns, rows = [], emptyLabel = "Nothing to show.", onRow, initialSort, caption }) {
  let data = rows;
  let sort = initialSort || null; // {key, dir}
  let page = 0;
  const root = h("div", { class: "table-card" });
  const wrap = h("div", { class: "table-wrap" });
  const foot = h("div", { class: "table-foot", hidden: true });
  root.append(wrap, foot);

  const getter = (c) => c.value || ((r) => r[c.key]);

  function draw() {
    let list = data;
    if (sort) { const c = columns.find((x) => x.key === sort.key); if (c) list = sortRows(list, getter(c), sort.dir); }
    if (!list.length) { wrap.replaceChildren(empty(emptyLabel)); foot.hidden = true; return; }
    const paged = list.length > PAGE_AT;
    const pg = paged ? paginate(list, page, PAGE_SIZE) : { items: list, pages: 1, page: 0, from: 1, to: list.length };
    page = pg.page;
    const head = h("tr", null, columns.map((c) => {
      const sortable = c.sortable !== false && c.label;
      const active = sort?.key === c.key;
      const th = h("th", { scope: "col", class: [c.align === "right" && "right", c.class], "aria-sort": active ? (sort.dir > 0 ? "ascending" : "descending") : null },
        sortable ? h("button", { type: "button", class: "th-btn", onClick: () => { sort = { key: c.key, dir: active ? -sort.dir : 1 }; page = 0; draw(); } }, c.label, h("span", { class: "sort-arrow", "aria-hidden": "true" }, active ? (sort.dir > 0 ? "▲" : "▼") : "")) : c.label);
      return th;
    }));
    const body = pg.items.map((r) => {
      const tr = h("tr", { class: onRow && "clickable", tabindex: onRow ? 0 : null, onClick: onRow ? () => onRow(r) : null, onKeydown: onRow ? (e) => { if (e.key === "Enter") onRow(r); } : null },
        columns.map((c) => h("td", { class: [c.align === "right" && "right", c.class] }, c.render ? c.render(r) : r[c.key] ?? "—")));
      return tr;
    });
    wrap.replaceChildren(h("table", { class: "table" }, caption ? h("caption", { class: "sr-only" }, caption) : null, h("thead", null, head), h("tbody", null, body)));
    foot.hidden = !paged;
    if (paged) {
      foot.replaceChildren(
        h("span", { class: "muted small" }, `${pg.from}–${pg.to} of ${list.length}`),
        h("div", { class: "row" },
          h("button", { type: "button", class: "btn btn--sm", disabled: pg.page === 0, onClick: () => { page--; draw(); } }, "Previous"),
          h("span", { class: "small muted" }, `Page ${pg.page + 1} / ${pg.pages}`),
          h("button", { type: "button", class: "btn btn--sm", disabled: pg.page >= pg.pages - 1, onClick: () => { page++; draw(); } }, "Next")));
    }
  }
  root.setRows = (r) => { data = r || []; page = 0; draw(); };
  draw();
  return root;
}
