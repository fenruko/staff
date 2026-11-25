import test from "node:test";
import assert from "node:assert/strict";
import { compilePath, matchRoute } from "../../assets/app/core/router.js";
import { createStore } from "../../assets/app/core/store.js";
import * as F from "../../assets/app/core/format.js";
import { appendSample, summarize, MAX_SAMPLES } from "../../assets/app/core/telemetry.js";
import { niceMax, linePoints, pathOf, donutSlices, stackSegments } from "../../assets/app/ui/charts.js";
import { hasPermission } from "../../assets/app/core/auth.js";
import { isUsable, isFresh, postUrl, bannerUrl, fetchLatestPost } from "../../assets/app/core/blog.js";
import { ROUTES } from "../../assets/app/routes.js";

test("router: params, wildcard, trailing slash, decode", () => {
  assert.ok(compilePath("/a/:id").regex.test("/a/5/"));
  const m = matchRoute([{ path: "/appeal/:token" }, { path: "*" }], "/appeal/a%20b");
  assert.equal(m.params.token, "a b");
  assert.equal(matchRoute([{ path: "/x" }, { path: "*" }], "/nope").route.path, "*");
  assert.equal(matchRoute([{ path: "/x" }], "/y"), null);
});

test("router: every non-public route has a perm and a lazy loader", () => {
  for (const r of ROUTES) {
    if (r.notFound || r.legacyAppeal) continue;
    assert.equal(typeof r.load, "function", r.id);
    if (!r.public) assert.ok(r.perm, `${r.id} must be permission gated`);
  }
  assert.equal(new Set(ROUTES.filter((r) => r.key).map((r) => r.key)).size, ROUTES.filter((r) => r.key).length, "g-shortcuts unique");
});

test("store: set/subscribe/unsubscribe, no-op on equal", () => {
  const s = createStore({ a: 1 });
  let n = 0;
  const off = s.subscribe(() => n++);
  s.set({ a: 1 });
  assert.equal(n, 0);
  s.set({ a: 2 });
  s.set((st) => ({ a: st.a + 1 }));
  assert.equal(s.get().a, 3);
  off();
  s.set({ a: 9 });
  assert.equal(n, 2);
});

test("store: a throwing subscriber does not break others", () => {
  const s = createStore({ a: 0 });
  let ok = 0;
  const orig = console.error; console.error = () => {};
  s.subscribe(() => { throw new Error("x"); });
  s.subscribe(() => ok++);
  s.set({ a: 1 });
  console.error = orig;
  assert.equal(ok, 1);
});

test("format: numbers, durations, ago, csv safety, pagination, sort", () => {
  assert.equal(F.fmtInt(1234567), "1,234,567");
  assert.equal(F.fmtInt(undefined), "0");
  assert.equal(F.fmtCompact(1500), "1.5K");
  assert.equal(F.fmtCompact(2_000_000), "2M");
  assert.equal(F.fmtPercent(null), "—");
  assert.equal(F.fmtPercent(12.345), "12.3%");
  assert.equal(F.fmtMB(2048), "2.0 GB");
  assert.equal(F.fmtMB(null), "—");
  assert.equal(F.fmtDuration(90061), "1d 1h");
  assert.equal(F.fmtDuration(0), "0s");
  assert.equal(F.fmtDuration("x"), "—");
  assert.equal(F.fmtAgo(1000, 1_060_000), "1m ago");
  assert.equal(F.fmtAgo(null), "—");
  assert.equal(F.toMs(1_700_000_000), 1_700_000_000_000);
  assert.equal(F.toMs("garbage"), null);
  assert.equal(F.csvCell("=cmd|' /C calc'!A0").startsWith("'="), true);
  assert.equal(F.csvCell('a,"b"'), '"a,""b"""');
  assert.equal(F.csvCell(-5), "-5");
  assert.equal(F.toCsv(["a", "b"], [[1, "x,y"]]), 'a,b\n1,"x,y"');
  const p = F.paginate(Array.from({ length: 250 }, (_, i) => i), 99, 100);
  assert.deepEqual([p.page, p.pages, p.items.length, p.from, p.to], [2, 3, 50, 201, 250]);
  assert.deepEqual(F.paginate([], 0, 10).items, []);
  assert.deepEqual(F.sortRows([{ n: "b10" }, { n: "b2" }, { n: null }], (r) => r.n).map((r) => r.n), ["b2", "b10", null]);
  assert.equal(F.isSnowflake("445190237866231"), true);
  assert.equal(F.isSnowflake("12"), false);
  assert.equal(F.shortId("445190237866231"), "…866231");
});

test("telemetry: caps at 120, coalesces <2s, tolerates missing fields", () => {
  let s = [];
  for (let i = 0; i < 300; i++) s = appendSample(s, { latency: i, cpu: 1, ram_percent: 2, users: 3, guild_count: 4 }, i * 3000);
  assert.equal(s.length, MAX_SAMPLES);
  const t = appendSample(s, { latency: 5 }, s.at(-1).time + 500);
  assert.equal(t.length, s.length);
  assert.equal(t.at(-1).cpu, null);
  assert.deepEqual(summarize([], "cpu"), { average: null, peak: null, change: null });
  assert.equal(summarize([{ x: 1 }, { x: 3 }], "x").average, 2);
});

test("charts math: niceMax, line points, donut, stacked", () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(73), 100);
  assert.equal(niceMax(12), 20);
  const pts = linePoints([0, 50, 100], 100, 50, { max: 100 });
  assert.deepEqual(pts, [[0, 50], [50, 25], [100, 0]]);
  assert.deepEqual(linePoints([5], 100, 10, { max: 10 })[0], [50, 5]);
  assert.equal(pathOf([[0, 1], [2, 3]]), "M0.0,1.0L2.0,3.0");
  const d = donutSlices([1, 1, 2]);
  assert.ok(Math.abs(d.reduce((a, s) => a + s.share, 0) - 1) < 1e-9);
  assert.equal(donutSlices([0, 0])[0].len, 0);
  const st = stackSegments({ a: 1, b: 3 }, ["a", "b", "c"]);
  assert.equal(st.total, 4);
  assert.equal(st.segs[1].pct, 75);
});

test("hasPermission: wildcard, single, any-of, anonymous", () => {
  assert.equal(hasPermission(null, "x"), false);
  assert.equal(hasPermission({ permissions: ["*"] }, "x"), true);
  assert.equal(hasPermission({ permissions: ["a"] }, "a"), true);
  assert.equal(hasPermission({ permissions: ["a"] }, ["b", "a"]), true);
  assert.equal(hasPermission({ permissions: ["a"] }, ["b", "c"]), false);
});

test("blog notice helpers", async () => {
  assert.equal(isUsable({ id: 1, slug: "s", title: "t" }), true);
  assert.equal(isUsable({ id: 1 }), false);
  assert.equal(postUrl({ slug: "a b" }), "https://rift.cool/blog/a%20b");
  assert.equal(bannerUrl("https://x/", "i d"), "https://x/api/blog/images/i%20d");
  assert.equal(isFresh({ published_at: 100 }, 100 + 86400), true);
  assert.equal(isFresh({ published_at: 100 }, 100 + 86400 * 30), false);
  const post = { id: 1, slug: "s", title: "t", status: "published", published_at: 1000 };
  const ok = await fetchLatestPost("https://x", { now: 1100, fetchImpl: async () => ({ ok: true, json: async () => ({ posts: [post] }) }) });
  assert.equal(ok.id, 1);
  assert.equal(await fetchLatestPost("https://x", { fetchImpl: async () => { throw new Error("net"); } }), null);
  assert.equal(await fetchLatestPost("https://x", { fetchImpl: async () => ({ ok: false }) }), null);
});
