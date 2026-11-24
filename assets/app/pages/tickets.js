import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, stat, statGrid, grid2, asyncView } from "../ui/components.js";
import { barList, donut } from "../ui/charts.js";
import { fmtInt, fmtDuration, titleCase } from "../core/format.js";

export default function tickets(ctx) {
  return h("div", { class: "stack" }, pageHead("Tickets & Reports"),
    asyncView(ctx.signal, () => api.tickets({ signal: ctx.signal }), (d) => {
      const t = d.tickets || {}, m = d.modmail || {}, r = d.reports || {};
      const by = r.by_status || {};
      return h("div", { class: "stack" },
        statGrid(
          stat({ label: "Open tickets", value: fmtInt(t.open), tone: "warning" }),
          stat({ label: "Closed tickets", value: fmtInt(t.closed), tone: "success" }),
          stat({ label: "Avg resolution", value: t.avg_resolution_seconds ? fmtDuration(t.avg_resolution_seconds) : "—", hint: "Per closed ticket" }),
          stat({ label: "Open modmail", value: fmtInt(m.open), tone: "warning", hint: `${fmtInt(m.total)} total threads` }),
          stat({ label: "Reports", value: fmtInt(r.total) }),
          ...Object.entries(by).map(([k, v]) => stat({ label: `Reports: ${titleCase(k)}`, value: fmtInt(v) }))),
        grid2(
          card("Ticket & modmail volume", { sub: "Open and closed threads across both queues" }, barList([
            { name: "Open tickets", value: Number(t.open) || 0 }, { name: "Closed tickets", value: Number(t.closed) || 0 },
            { name: "Open modmail", value: Number(m.open) || 0 }, { name: "Total modmail", value: Number(m.total) || 0 }], { label: "Ticket volume" })),
          card("Reports by status", null, donut(Object.entries(by).map(([k, v]) => ({ name: titleCase(k), value: Number(v) || 0 })), { centerLabel: "Reports", label: "Reports by status" }))));
    }));
}
