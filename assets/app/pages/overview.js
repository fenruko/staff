import { h, mount, rafBatch } from "../core/dom.js";
import { api } from "../core/api.js";
import { connectExecSocket } from "../core/ws.js";
import { appendSample, summarize } from "../core/telemetry.js";
import { fmtInt, fmtDuration, fmtMB, fmtTime, numeric, toCsv, downloadText, fmtPercent } from "../core/format.js";
import { pageHead, card, stat, statGrid, btn, pill, badge, segmented, errorState, skeleton, kv, empty } from "../ui/components.js";
import { areaChart, sparkline, gauge, COLORS } from "../ui/charts.js";
import { icon } from "../ui/icons.js";

const METRICS = {
  latency: { label: "Latency", unit: " ms", color: COLORS[1] },
  cpu: { label: "CPU", unit: "%", color: COLORS[2] },
  ram: { label: "RAM", unit: "%", color: COLORS[0] },
  users: { label: "Users", unit: "", color: COLORS[7] },
  guilds: { label: "Guilds", unit: "", color: COLORS[3] },
};
const disp = (v, unit = "") => (v === null || v === undefined ? "—" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`);

export default function overview(ctx) {
  let data = null, samples = [], metric = "latency", conn = "connecting", updated = 0, error = null;
  const body = h("div", { class: "stack" }, skeleton(4));
  const head = pageHead("Overview", { actions: [btn("Refresh", { ic: "refresh", onClick: () => refresh() }), btn("Export CSV", { ic: "download", onClick: exportCsv })] });
  const root = h("div", { class: "stack" }, head, body);
  const chartHost = h("div");
  const statusHost = h("div", { class: "row" });
  const tilesHost = h("div");
  const healthHost = h("div");
  const cogsHost = h("div");
  let cogQuery = "";
  let built = false;

  const live = () => conn === "connected" && updated && Date.now() - updated < 45000;

  function accept(d) {
    if (!d || typeof d !== "object") return;
    data = d; error = null; updated = Date.now();
    samples = appendSample(samples, d);
    schedule();
  }

  async function refresh() {
    try { accept(await api.overview({ signal: ctx.signal })); }
    catch (e) { if (e.name === "AbortError") return; error = e; schedule(); }
  }

  const schedule = rafBatch(() => draw());

  function exportCsv() {
    if (!samples.length) return;
    downloadText("rift-session-telemetry.csv", toCsv(["timestamp", "latency_ms", "cpu_percent", "ram_percent", "users", "guilds"],
      samples.map((s) => [new Date(s.time).toISOString(), s.latency, s.cpu, s.ram, s.users, s.guilds])));
  }

  function series(key) { return samples.map((s) => s[key]).filter((v) => v !== null); }

  function drawTiles() {
    const lat = numeric(data.latency);
    mount(tilesHost, statGrid(
      stat({ label: "Guilds", value: fmtInt(data.guild_count ?? data.servers), icon: "guilds", spark: sparkline(series("guilds"), { color: COLORS[3], label: "Guilds" }) }),
      stat({ label: "Users", value: fmtInt(data.users), icon: "users", spark: sparkline(series("users"), { color: COLORS[7], label: "Users" }) }),
      stat({ label: "API latency", value: disp(lat, " ms"), icon: "activity", tone: lat === null ? null : lat > 300 ? "danger" : lat > 180 ? "warning" : "success", hint: lat === null ? "Not reported" : lat > 300 ? "High" : "Healthy", spark: sparkline(series("latency"), { color: COLORS[1], label: "Latency" }) }),
      stat({ label: "Uptime", value: fmtDuration(data.uptime), icon: "clock", hint: "Since last restart" })));
  }

  function drawChart() {
    const m = METRICS[metric];
    const st = summarize(samples, metric);
    const pts = samples.filter((s) => s[metric] !== null).map((s) => ({ t: s.time, v: s[metric] }));
    mount(chartHost,
      areaChart(pts, { color: m.color, unit: m.unit, label: `${m.label} this session`, timeFmt: fmtTime, format: (v) => disp(v) }),
      h("div", { class: "mini-stats" },
        h("div", null, h("span", null, "Average"), h("strong", null, disp(st.average, m.unit))),
        h("div", null, h("span", null, "Peak"), h("strong", null, disp(st.peak, m.unit))),
        h("div", null, h("span", null, "Net change"), h("strong", null, st.change === null ? "—" : `${st.change > 0 ? "+" : ""}${disp(st.change, m.unit)}`))),
      h("p", { class: "card-sub" }, "Collected in this tab: up to 120 live readings. The API has no history endpoint."));
  }

  function drawHealth() {
    const ramPct = numeric(data.ram_percent);
    const ramSub = numeric(data.ram_used) !== null && numeric(data.ram_total) !== null ? `${fmtMB(data.ram_used)} of ${fmtMB(data.ram_total)}` : undefined;
    const la = Array.isArray(data.load_avg) ? data.load_avg.map((x) => Number(x).toFixed(2)).join(" · ") : "—";
    mount(healthHost,
      h("div", { class: "gauges" }, gauge(numeric(data.cpu), { label: "CPU", color: COLORS[2] }), gauge(ramPct, { label: "RAM", sub: ramSub, color: COLORS[0] }), gauge(numeric(data.disk_percent), { label: "Disk", color: COLORS[3] })),
      kv([
        ["Process RSS", fmtMB(data.process_rss_mb)], ["Threads", disp(numeric(data.threads))], ["Load avg (1/5/15m)", la],
        ["Shards", disp(numeric(data.shards))], ["Voice connections", disp(numeric(data.voice_connections))], ["Exec WS clients", disp(numeric(data.exec_clients))],
        ["Channels", numeric(data.text_channels) === null ? "—" : `${fmtInt(data.text_channels)} text · ${fmtInt(data.voice_channels)} voice`], ["Commands", disp(numeric(data.commands))],
        ["Python", data.python || "—"], ["discord.py", data.discord_py || "—"],
      ]));
  }

  function drawCogs() {
    const cogs = Array.isArray(data.cogs_loaded) ? data.cogs_loaded : [];
    const q = cogQuery.toLowerCase();
    const shown = cogs.filter((c) => c.toLowerCase().includes(q));
    mount(cogsHost, shown.length ? h("div", { class: "chips" }, shown.map((c) => h("span", { class: "chip" }, c))) : empty(cogs.length ? "No cogs match." : "No cog list reported."));
  }

  function build() {
    built = true;
    const cogSearch = h("input", { class: "input input--sm", type: "search", placeholder: "Filter cogs…", "aria-label": "Filter cogs", onInput: (e) => { cogQuery = e.target.value; drawCogs(); } });
    const seg = segmented(Object.entries(METRICS).map(([k, m]) => [k, m.label]), metric, (k) => { metric = k; drawChart(); }, "Chart metric");
    mount(body,
      statusHost, tilesHost,
      h("div", { class: "grid-wide" },
        card("Telemetry", { sub: "Live session readings", actions: seg }, chartHost),
        card("System health", { actions: h("span", { class: "muted small" }, "latest snapshot") }, healthHost)),
      h("div", { class: "grid-wide" },
        card(`Loaded cogs`, { sub: "Class names as reported by the bot", actions: cogSearch }, cogsHost),
        card("Quick access", null, quick())));
  }

  function quick() {
    const items = [["/moderation", "moderation.view", "shield", "Moderation", "Look up users, run actions"], ["/appeals", "appeals.view", "message", "Ban appeals", "Review the queue"], ["/guilds", "guilds.view", "guilds", "Guilds", "Servers the bot is in"], ["/bot-control", "bot.control", "control", "Bot control", "Cogs, maintenance"], ["/logs", ["logs.view", "audit.view"], "logs", "Logs & audit", "Errors and staff actions"]];
    const shown = items.filter(([, p]) => ctx.can(p));
    return shown.length ? h("div", { class: "quick" }, shown.map(([href, , ic, t, s]) => h("a", { href, class: "quick-item" }, icon(ic, 18), h("span", null, h("strong", null, t), h("small", null, s))))) : empty("Nothing else to open with your permissions.");
  }

  function draw() {
    if (!data) { if (error) mount(body, errorState(error.message, () => { mount(body, skeleton(4)); refresh(); })); return; }
    if (!built) build();
    mount(statusHost,
      pill(live() ? "Live updates" : "Snapshot mode", live() ? "ok" : "warn"),
      data.maintenance ? badge("Maintenance mode on", "warning") : null,
      h("span", { class: "muted small" }, `Last received ${updated ? fmtTime(updated) : "—"}`),
      error ? h("span", { class: "small", style: { color: "var(--danger)" } }, "Refresh failed; showing the last snapshot") : null);
    drawTiles(); drawChart(); drawHealth(); drawCogs();
  }

  refresh();
  ctx.scope.add(connectExecSocket((msg) => { if (msg.type === "overview") accept(msg.data); }, (s) => { conn = s; schedule(); }));
  ctx.scope.interval(() => { if (!document.hidden && !live()) refresh(); else schedule(); }, 15000);
  return root;
}
