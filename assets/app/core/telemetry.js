import { numeric } from "./format.js";

export const MAX_SAMPLES = 120;

export function appendSample(samples, d, now = Date.now()) {
  const sample = {
    time: now,
    latency: numeric(d.latency),
    cpu: numeric(d.cpu),
    ram: numeric(d.ram_percent),
    users: numeric(d.users),
    guilds: numeric(d.guild_count ?? d.servers),
  };
  const prev = samples.at(-1);
  // At most one sample every two seconds, never more than MAX_SAMPLES points.
  const next = prev && now - prev.time < 2000 ? [...samples.slice(0, -1), sample] : [...samples, sample];
  return next.slice(-MAX_SAMPLES);
}

export function summarize(samples, key) {
  const v = samples.map((s) => s[key]).filter((x) => x !== null && Number.isFinite(x));
  if (!v.length) return { average: null, peak: null, change: null };
  return { average: v.reduce((a, b) => a + b, 0) / v.length, peak: Math.max(...v), change: v.length > 1 ? v.at(-1) - v[0] : null };
}
