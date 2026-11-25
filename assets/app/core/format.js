/* Pure formatting helpers (unit-tested in Node). */

export const num = (v, d = 0) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
export const numeric = (v) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, num(v)));

const nf = new Intl.NumberFormat("en-US");
export const fmtInt = (v) => nf.format(Math.round(num(v)));
export function fmtCompact(v) {
  const n = num(v);
  const a = Math.abs(n);
  const t = (x) => x.toFixed(1).replace(/\.0$/, "");
  if (a >= 1e9) return `${t(n / 1e9)}B`;
  if (a >= 1e6) return `${t(n / 1e6)}M`;
  if (a >= 1e3) return `${t(n / 1e3)}K`;
  return String(Math.round(n * 10) / 10);
}
export const fmtPercent = (v, d = 1) => (numeric(v) === null ? "—" : `${num(v).toFixed(d)}%`);
export const fmtSigned = (v) => `${num(v) > 0 ? "+" : ""}${fmtInt(v)}`;
export function fmtMB(v) {
  const n = numeric(v);
  if (n === null) return "—";
  return n >= 1024 ? `${(n / 1024).toFixed(n >= 10240 ? 0 : 1)} GB` : `${Math.round(n)} MB`;
}
/** 1234567 -> "1d 5h 12m"; keeps the two largest non-zero units. */
export function fmtDuration(seconds) {
  const n = numeric(seconds);
  if (n === null) return "—";
  let s = Math.max(0, Math.floor(n));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const hr = Math.floor(s / 3600); s -= hr * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const parts = [[d, "d"], [hr, "h"], [m, "m"], [s, "s"]].filter(([v]) => v > 0);
  if (!parts.length) return "0s";
  return parts.slice(0, 2).map(([v, u]) => `${v}${u}`).join(" ");
}
/** Seconds or ms or ISO string -> ms epoch (null if unusable). */
export function toMs(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.getTime();
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isFinite(n)) return n > 1e12 ? n : n * 1000;
  const p = Date.parse(v);
  return Number.isFinite(p) ? p : null;
}
export function fmtAgo(v, now = Date.now()) {
  const ms = toMs(v);
  if (ms === null) return "—";
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 60) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / (86400 * 30))}mo ago`;
}
export const fmtDate = (v) => { const ms = toMs(v); return ms === null ? "—" : new Date(ms).toLocaleDateString(); };
export const fmtDateTime = (v) => { const ms = toMs(v); return ms === null ? "—" : new Date(ms).toLocaleString(); };
export const fmtTime = (v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const shortId = (id) => { const s = String(id ?? ""); return s.length > 8 ? `…${s.slice(-6)}` : s; };
export const titleCase = (s) => String(s ?? "").replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const isSnowflake = (s) => /^\d{15,22}$/.test(String(s ?? ""));

/* ---- CSV ---- */
export function csvCell(v) {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection from user-controlled strings.
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (headers, rows) => [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");

export function downloadText(filename, text, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function paginate(rows, page, size) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { page: p, pages, items: rows.slice(p * size, p * size + size), from: rows.length ? p * size + 1 : 0, to: Math.min(rows.length, p * size + size) };
}

export function sortRows(rows, getter, dir = 1) {
  return [...rows].sort((a, b) => {
    const x = getter(a), y = getter(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
    return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * dir;
  });
}
