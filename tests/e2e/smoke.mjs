/* Optional browser smoke test (needs `playwright` installed somewhere resolvable and
 * a Chrome binary: CHROME=/usr/bin/google-chrome node tests/e2e/smoke.mjs [outDir]).
 * Drives the demo backend, visits every route in both themes, fails on console errors. */
import { mkdirSync } from "node:fs";
import { createStaticServer } from "../../tools/serve.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const out = process.argv[2];
if (out) mkdirSync(out, { recursive: true });
const server = createStaticServer();
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const routes = ["/", "/economy", "/moderation", "/tickets", "/appeals", "/bugreports", "/blacklist", "/voice", "/verification", "/leaderboards", "/guilds", "/logs", "/bot-control", "/staff"];
const failures = [];
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("rift_staff_prefs", JSON.stringify({ theme: t })); } catch {} }, theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  await page.goto(`${base}/login?demo=1`);
  await page.fill("#username", "demo");
  await page.fill("input[type=password]", "demo");
  await page.click("button[type=submit]");
  await page.waitForSelector(".shell", { timeout: 8000 });
  for (const r of routes) {
    errors.length = 0;
    await page.goto(base + r);
    await page.waitForSelector(".page", { timeout: 8000 });
    await page.waitForTimeout(500);
    if (out && ["/", "/moderation", "/bot-control", "/guilds"].includes(r)) await page.screenshot({ path: `${out}/${r === "/" ? "overview" : r.slice(1)}-${theme}.png` });
    await page.keyboard.press("Control+k");
    const palette = await page.waitForSelector(".palette-input", { timeout: 3000 }).then(() => 1, () => 0);
    await page.keyboard.press("Escape");
    if (!palette) errors.push("command palette did not open");
    if (errors.length) failures.push(`${theme} ${r}: ${errors.join(" | ")}`);
  }
  await ctx.close();
}
await browser.close();
server.close();
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`smoke ok: ${routes.length} routes x 2 themes, no console errors`);
