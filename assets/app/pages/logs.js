import { h, mount, debounce } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, grid2, tabs, asyncView, select, input, btn, copyText, errorState, skeleton, segmented } from "../ui/components.js";
import { barList, donut } from "../ui/charts.js";
import { dataTable } from "../ui/table.js";
import { toCsv, downloadText, fmtDateTime } from "../core/format.js";

const SEV = /\b(CRITICAL|ERROR|WARNING|WARN|INFO|DEBUG)\b/;
export const severityOf = (line) => { const m = SEV.exec(line); return m ? (m[1] === "WARN" ? "WARNING" : m[1]) : "OTHER"; };

export default function logs(ctx) {
  const canErr = ctx.can("logs.view"), canAudit = ctx.can("audit.view");
  let tab = canErr ? "errors" : "audit";
  const host = h("div", { class: "stack" });
  const tabBar = tabs([canErr && ["errors", "Error log"], canAudit && ["audit", "Staff audit log"]].filter(Boolean), tab, (t) => { tab = t; draw(); });
  const root = h("div", { class: "stack" }, pageHead("Logs & Audit"), tabs ? tabBar : null, host);
  let views = {};

  const errors = () => {
    let lines = [], sev = "", q = "", follow = true;
    const out = h("pre", { class: "logbox", tabindex: 0, "aria-label": "Error log lines" });
    const chartHost = h("div");
    const paint = () => {
      const shown = lines.filter((l) => (!sev || severityOf(l) === sev) && (!q || l.toLowerCase().includes(q)));
      out.textContent = shown.length ? shown.join("\n") : lines.length ? "No lines match the filters." : "No error log found.";
      if (follow) out.scrollTop = out.scrollHeight;
      const c = {};
      for (const l of lines) c[severityOf(l)] = (c[severityOf(l)] || 0) + 1;
      mount(chartHost, donut(Object.entries(c).map(([name, value]) => ({ name, value })), { centerLabel: "Lines", label: "Lines by severity" }));
      count.textContent = `${shown.length} / ${lines.length} lines`;
    };
    const count = h("span", { class: "muted small" });
    const followBox = h("input", { type: "checkbox", checked: true, onChange: (e) => { follow = e.target.checked; if (follow) out.scrollTop = out.scrollHeight; } });
    const loadLines = async (quiet) => {
      try { const d = await api.errorLogs(400, { signal: ctx.signal }); lines = d?.lines || []; paint(); } catch (e) { if (e.name !== "AbortError" && !quiet) out.textContent = `Couldn't load the log: ${e.message}`; }
    };
    const timer = { id: null };
    const tailBox = h("input", { type: "checkbox", onChange: (e) => { clearInterval(timer.id); if (e.target.checked) timer.id = setInterval(() => !document.hidden && loadLines(true), 5000); } });
    ctx.scope.add(() => clearInterval(timer.id));
    const search = debounce((v) => { q = v.trim().toLowerCase(); paint(); }, 150);
    const bar = h("div", { class: "toolbar" },
      select([["", "All severities"], ["CRITICAL", "Critical"], ["ERROR", "Error"], ["WARNING", "Warning"], ["INFO", "Info"]], { "aria-label": "Severity filter", onChange: (e) => { sev = e.target.value; paint(); } }),
      input({ type: "search", placeholder: "Search lines…", "aria-label": "Search log", onInput: (e) => search(e.target.value) }),
      h("label", { class: "check" }, tailBox, "Tail (refresh 5s)"), h("label", { class: "check" }, followBox, "Follow end"),
      btn("Refresh", { sm: true, ic: "refresh", onClick: () => loadLines() }), btn("Copy", { sm: true, ic: "copy", onClick: () => copyText(out.textContent) }), count);
    loadLines();
    return h("div", { class: "stack" }, grid2(card("Lines by severity", null, chartHost), h("div")), card("Error log tail", { actions: bar }, out));
  };

  const audit = () => asyncView(ctx.signal, () => api.auditLog(500, { signal: ctx.signal }), (rows) => {
    rows = Array.isArray(rows) ? rows : [];
    let action = "", staff = "";
    const actions = [...new Set(rows.map((r) => r.action))].sort(), staffs = [...new Set(rows.map((r) => r.username))].sort();
    const table = dataTable({ emptyLabel: "No audit entries match.", initialSort: { key: "timestamp", dir: -1 }, columns: [
      { key: "username", label: "Staff" }, { key: "action", label: "Action" }, { key: "target", label: "Target" }, { key: "ip", label: "IP", class: "mono" },
      { key: "timestamp", label: "When", render: (r) => fmtDateTime(r.timestamp), value: (r) => Number(r.timestamp) }] });
    const sel = () => rows.filter((r) => (!action || r.action === action) && (!staff || r.username === staff));
    const apply = () => table.setRows(sel());
    apply();
    const csv = () => downloadText("rift-audit-log.csv", toCsv(["timestamp", "staff", "action", "target", "ip"], sel().map((r) => [new Date(r.timestamp * 1000).toISOString(), r.username, r.action, r.target, r.ip])));
    const byAction = Object.entries(rows.reduce((t, r) => { t[r.action] = (t[r.action] || 0) + 1; return t; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return h("div", { class: "stack" },
      card("Entries by action", { sub: `${rows.length} loaded entries` }, barList(byAction.slice(0, 8), { label: "Entries by action" })),
      card("Audit log", { actions: h("div", { class: "toolbar" },
        select([["", "All actions"], ...actions.map((a) => [a, a])], { "aria-label": "Action filter", onChange: (e) => { action = e.target.value; apply(); } }),
        select([["", "All staff"], ...staffs.map((a) => [a, a])], { "aria-label": "Staff filter", onChange: (e) => { staff = e.target.value; apply(); } }),
        btn("Export CSV", { sm: true, ic: "download", onClick: csv })) }, table));
  });

  function draw() {
    views[tab] = views[tab] || (tab === "errors" ? errors() : audit());
    mount(host, views[tab]);
  }
  if (!canErr && !canAudit) host.append(h("p", { class: "empty" }, "No log permissions."));
  else draw();
  return root;
}
