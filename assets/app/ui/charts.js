/* Hand-rolled SVG/CSS charts. Animations use transform/opacity only. Every chart
 * has role=img + aria-label (or labelled rows) and keyboard-focusable parts. */
import { h } from "../core/dom.js";
import { fmtCompact, fmtInt } from "../core/format.js";

export const COLORS = ["#00b8ff", "#34d399", "#a78bfa", "#fbbf24", "#f472b6", "#22d3ee", "#fb923c", "#60a5fa"];

/* ---- pure math (unit-tested) ---- */
export function niceMax(v) {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(v));
  const f = v / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * base;
}
export function linePoints(values, w, hgt, { min = 0, max } = {}) {
  const top = max ?? niceMax(Math.max(...values, 0));
  const span = top - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => [values.length > 1 ? i * step : w / 2, hgt - ((v - min) / span) * hgt]);
}
export const pathOf = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
export function donutSlices(values, r = 40) {
  const total = values.reduce((a, b) => a + b, 0);
  const C = 2 * Math.PI * r;
  let off = 0;
  return values.map((v) => {
    const len = total ? (v / total) * C : 0;
    const s = { len, gap: C - len, offset: -off, share: total ? v / total : 0 };
    off += len;
    return s;
  });
}
export function stackSegments(row, keys) {
  const total = keys.reduce((a, k) => a + (Number(row[k]) || 0), 0);
  return { total, segs: keys.map((k) => ({ key: k, value: Number(row[k]) || 0, pct: total ? ((Number(row[k]) || 0) / total) * 100 : 0 })) };
}

/* ---- tooltip ---- */
let tip;
function tipEl() {
  if (!tip) { tip = h("div", { class: "tip", role: "tooltip", hidden: true }); document.body.append(tip); }
  return tip;
}
export function showTip(text, x, y) {
  const t = tipEl();
  t.textContent = text;
  t.hidden = false;
  const w = t.offsetWidth || 120;
  t.style.transform = `translate(${Math.max(8, Math.min(x + 12, innerWidth - w - 8))}px, ${Math.max(8, y - 36)}px)`;
}
export const hideTip = () => { if (tip) tip.hidden = true; };
function tipOn(node, textFn) {
  const at = (e) => { const r = node.getBoundingClientRect(); return e.clientX != null && e.type.startsWith("pointer") ? [e.clientX, e.clientY] : [r.left + r.width / 2, r.top]; };
  for (const ev of ["pointerenter", "pointermove", "focus"]) node.addEventListener(ev, (e) => { const [x, y] = at(e); showTip(textFn(), x, y); });
  for (const ev of ["pointerleave", "blur"]) node.addEventListener(ev, hideTip);
}

const svg = (tag, a, ...k) => h(tag, a, ...k);

export function sparkline(values, { color = COLORS[0], w = 120, hgt = 30, label = "Trend" } = {}) {
  const v = (values || []).filter(Number.isFinite);
  if (v.length < 2) return h("span", { class: "spark spark--empty", "aria-hidden": "true" });
  const lo = Math.min(...v), hi = Math.max(...v);
  const pts = linePoints(v, w, hgt - 4, { min: lo, max: hi === lo ? lo + 1 : hi }).map(([x, y]) => [x, y + 2]);
  const line = pathOf(pts);
  return svg("svg", { class: "spark", viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: "none", role: "img", "aria-label": `${label}: ${fmtCompact(v.at(-1))} now, range ${fmtCompact(lo)} to ${fmtCompact(hi)}` },
    svg("path", { d: `${line}L${w},${hgt}L0,${hgt}Z`, fill: color, opacity: 0.14 }),
    svg("path", { d: line, fill: "none", stroke: color, "stroke-width": 1.6, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" }));
}

/** Time-series area chart. points: [{t, v}]. Hover/arrow keys show a readout. */
export function areaChart(points, { color = COLORS[0], format = fmtInt, unit = "", label = "Chart", timeFmt = (t) => new Date(t).toLocaleTimeString(), height = 190 } = {}) {
  const W = 800;
  const root = h("div", { class: "area", style: { height: `${height}px` } });
  if (points.length < 2) { root.append(h("p", { class: "empty" }, "Waiting for more readings…")); return root; }
  const vals = points.map((p) => p.v);
  const hi = niceMax(Math.max(...vals));
  const pts = linePoints(vals, W, height - 20, { min: 0, max: hi }).map(([x, y]) => [x, y + 6]);
  const line = pathOf(pts);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const grid = [0, 0.5, 1].map((f) => svg("line", { x1: 0, x2: W, y1: 6 + (height - 20) * f, y2: 6 + (height - 20) * f, class: "grid-line", "vector-effect": "non-scaling-stroke" }));
  const chart = svg("svg", { class: "area-svg", viewBox: `0 0 ${W} ${height}`, preserveAspectRatio: "none", "aria-hidden": "true" },
    ...grid, svg("path", { d: `${line}L${W},${height - 14}L0,${height - 14}Z`, fill: color, opacity: 0.13 }),
    svg("path", { d: line, fill: "none", stroke: color, "stroke-width": 2, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" }));
  const cursor = h("div", { class: "area-cursor", hidden: true }, h("i", { style: { background: color } }));
  const axis = h("div", { class: "area-axis" }, h("span", null, timeFmt(points[0].t)), h("span", null, `max ${format(hi)}${unit}`), h("span", null, timeFmt(points.at(-1).t)));
  const wrap = h("div", { class: "area-plot", tabindex: 0, role: "img", "aria-label": `${label}. ${points.length} samples, average ${format(avg)}${unit}, peak ${format(Math.max(...vals))}${unit}. Use arrow keys to read values.` }, chart, cursor);
  const show = (i, cx, cy) => {
    i = Math.max(0, Math.min(points.length - 1, i));
    cursor.hidden = false;
    cursor.style.transform = `translateX(${(i / (points.length - 1)) * wrap.clientWidth}px)`;
    cursor.firstChild.style.top = `${(pts[i][1] / height) * 100}%`;
    const r = wrap.getBoundingClientRect();
    showTip(`${timeFmt(points[i].t)} · ${format(points[i].v)}${unit}`, cx ?? r.left + (i / (points.length - 1)) * r.width, cy ?? r.top + (pts[i][1] / height) * r.height);
    wrap.dataset.i = i;
  };
  wrap.addEventListener("pointermove", (e) => { const r = wrap.getBoundingClientRect(); show(Math.round(((e.clientX - r.left) / (r.width || 1)) * (points.length - 1)), e.clientX, e.clientY); });
  const leave = () => { cursor.hidden = true; hideTip(); };
  wrap.addEventListener("pointerleave", leave);
  wrap.addEventListener("blur", leave);
  wrap.addEventListener("keydown", (e) => {
    const i = Number(wrap.dataset.i ?? points.length - 1);
    if (e.key === "ArrowLeft") { e.preventDefault(); show(i - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); show(i + 1); }
    else if (e.key === "Home") { e.preventDefault(); show(0); }
    else if (e.key === "End") { e.preventDefault(); show(points.length - 1); }
  });
  root.append(wrap, axis);
  return root;
}

/** Horizontal bar list. data: [{name, value, node?, hint?}] */
export function barList(data, { format = fmtInt, max: forcedMax, label = "Bar chart", empty = "No data yet." } = {}) {
  const rows = (data || []).filter((d) => Number.isFinite(d.value));
  if (!rows.length) return h("p", { class: "empty" }, empty);
  const max = forcedMax ?? Math.max(...rows.map((r) => r.value), 1);
  return h("ul", { class: "bars", role: "list", "aria-label": label }, rows.map((r, i) => {
    const li = h("li", { class: "bar-row", tabindex: 0, "aria-label": `${r.name}: ${format(r.value)}${r.hint ? `, ${r.hint}` : ""}` },
      h("span", { class: "bar-name" }, r.node || r.name),
      h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: { transform: `scaleX(${Math.max(0.01, r.value / max)})`, background: COLORS[i % COLORS.length], "--i": i } })),
      h("span", { class: "bar-val" }, format(r.value)));
    tipOn(li, () => `${r.name}: ${format(r.value)}${r.hint ? ` · ${r.hint}` : ""}`);
    return li;
  }));
}

export function donut(data, { centerLabel = "Total", format = fmtInt, label = "Distribution" } = {}) {
  const rows = (data || []).filter((d) => d.value > 0);
  if (!rows.length) return h("p", { class: "empty" }, "No data yet.");
  const total = rows.reduce((a, d) => a + d.value, 0);
  const sl = donutSlices(rows.map((d) => d.value), 40);
  const arcs = rows.map((d, i) => svg("circle", { cx: 50, cy: 50, r: 40, fill: "none", stroke: COLORS[i % COLORS.length], "stroke-width": 12, "stroke-dasharray": `${sl[i].len} ${sl[i].gap}`, "stroke-dashoffset": sl[i].offset, transform: "rotate(-90 50 50)" }));
  return h("div", { class: "donut" },
    h("div", { class: "donut-plot", role: "img", "aria-label": `${label}: ${rows.map((d) => `${d.name} ${format(d.value)}`).join(", ")}` },
      svg("svg", { viewBox: "0 0 100 100", "aria-hidden": "true" }, svg("circle", { cx: 50, cy: 50, r: 40, fill: "none", class: "donut-bg", "stroke-width": 12 }), ...arcs),
      h("div", { class: "donut-center" }, h("strong", null, format(total)), h("span", null, centerLabel))),
    h("ul", { class: "legend" }, rows.map((d, i) => {
      const li = h("li", { tabindex: 0 }, h("i", { style: { background: COLORS[i % COLORS.length] } }), h("span", null, d.name), h("b", null, `${format(d.value)} · ${Math.round(sl[i].share * 100)}%`));
      tipOn(li, () => `${d.name}: ${format(d.value)} (${Math.round(sl[i].share * 100)}%)`);
      return li;
    })));
}

/** Stacked horizontal bars. rows: [{name|node, ...series}], series: [{key,label}] */
export function stackedBars(rows, series, { label = "Stacked bars", empty = "No data yet." } = {}) {
  const data = (rows || []).map((r) => ({ r, ...stackSegments(r, series.map((s) => s.key)) })).filter((d) => d.total > 0);
  if (!data.length) return h("p", { class: "empty" }, empty);
  const max = Math.max(...data.map((d) => d.total));
  return h("div", null,
    h("ul", { class: "legend legend--row" }, series.map((s, i) => h("li", null, h("i", { style: { background: COLORS[i % COLORS.length] } }), h("span", null, s.label)))),
    h("ul", { class: "bars", role: "list", "aria-label": label }, data.map((d) => {
      const desc = series.map((s) => `${s.label} ${fmtInt(d.r[s.key] || 0)}`).join(", ");
      const li = h("li", { class: "bar-row", tabindex: 0, "aria-label": `${d.r.name}: ${desc}` },
        h("span", { class: "bar-name" }, d.r.node || d.r.name),
        h("span", { class: "bar-track" }, h("span", { class: "stackbar", style: { width: `${(d.total / max) * 100}%` } }, d.segs.map((s, i) => s.value ? h("span", { style: { flexGrow: s.value, background: COLORS[i % COLORS.length] } }) : null))),
        h("span", { class: "bar-val" }, fmtInt(d.total)));
      tipOn(li, () => `${d.r.name}: ${desc}`);
      return li;
    })));
}

/** Ring gauge 0-100. */
export function gauge(value, { label, sub, color = COLORS[0], warn = 80, danger = 92 } = {}) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  const c = v === null ? "var(--text-mute)" : v >= danger ? "var(--danger)" : v >= warn ? "var(--warning)" : color;
  const C = 2 * Math.PI * 42;
  return h("div", { class: "gauge", role: "img", "aria-label": `${label}: ${v === null ? "not reported" : `${v.toFixed(1)}%`}` },
    svg("svg", { viewBox: "0 0 100 100", "aria-hidden": "true" },
      svg("circle", { cx: 50, cy: 50, r: 42, fill: "none", class: "donut-bg", "stroke-width": 8 }),
      svg("circle", { cx: 50, cy: 50, r: 42, fill: "none", stroke: c, "stroke-width": 8, "stroke-linecap": "round", "stroke-dasharray": `${((v ?? 0) / 100) * C} ${C}`, transform: "rotate(-90 50 50)", class: "gauge-arc" })),
    h("div", { class: "gauge-text" }, h("strong", null, v === null ? "—" : `${v.toFixed(v >= 100 ? 0 : 1)}%`), h("span", null, label), sub ? h("em", null, sub) : null));
}
