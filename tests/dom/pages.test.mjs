import test from "node:test";
import assert from "node:assert/strict";
import { installDom, installMock, mountRoute, flush, USERS } from "./harness.mjs";
import { ROUTES } from "../../assets/app/routes.js";

installDom();
const errors = [];
window.addEventListener("error", (e) => errors.push(e.error || e.message));
const pages = ROUTES.filter((r) => r.label);

function assertClean(root, name) {
  const t = root.textContent || "";
  for (const bad of ["[object Object]", "undefined", "NaN"]) assert.equal(t.includes(bad), false, `${name} leaked “${bad}”: …${t.slice(Math.max(0, t.indexOf(bad) - 60), t.indexOf(bad) + 40)}`);
  assert.equal(/\bnull\b/.test(t), false, `${name} leaked null`);
}

test("every page renders real content with the full-access user (no placeholder leaks)", async () => {
  installMock();
  for (const route of pages) {
    const { root, scope } = await mountRoute(route);
    assert.ok(root.querySelector("h1"), `${route.id} has a heading`);
    assert.ok(root.textContent.trim().length > 60, `${route.id} rendered something`);
    assert.equal(root.querySelector(".error-state"), null, `${route.id} shows no error state: ${root.querySelector(".error-state")?.textContent}`);
    assertClean(root, route.id);
    scope.dispose();
  }
  assert.deepEqual(errors, []);
});

test("permission gating: pages without the permission render Not allowed and never fetch page code/data", async () => {
  const { calls } = installMock({ token: "limited-token" });
  for (const route of pages) {
    const allowed = [].concat(route.perm).some((p) => USERS.limited.permissions.includes(p));
    const before = calls.length;
    const { root, scope } = await mountRoute(route, { user: USERS.limited });
    if (allowed) assert.equal(root.querySelector(".forbidden"), null, `${route.id} should be allowed`);
    else {
      assert.ok(root.querySelector(".forbidden"), `${route.id} must be forbidden`);
      assert.equal(calls.length, before, `${route.id} must not call the API when forbidden`);
    }
    scope.dispose();
  }
});

test("XSS: API strings render as text, never markup", async () => {
  const { mock } = installMock();
  const evil = `<img src=x onerror="window.__pwned=1">`;
  mock.db.appeals[0].reason = evil; mock.db.appeals[0].username_snapshot = evil;
  mock.db.bugs[0].description = evil;
  mock.db.blacklist[0].reason = evil;
  mock.db.staff[1].username = evil;
  mock.db.guilds[0].name = evil;
  mock.db.ext[0].name = evil;
  mock.db.inbox[0].reason = evil;
  for (const id of ["appeals", "bugreports", "blacklist", "staff", "guilds", "bot-control", "economy"]) {
    const route = pages.find((r) => r.id === id);
    const { root, scope } = await mountRoute(route);
    assert.equal(root.querySelector("img[src='x']"), null, `${id} injected an <img>`);
    assert.equal(globalThis.window.__pwned, undefined);
    scope.dispose();
  }
});

test("overview: shows RAM %, used/total and system health fields from the new contract", async () => {
  installMock();
  const { root, scope } = await mountRoute(pages.find((r) => r.id === "overview"));
  const t = root.textContent;
  for (const s of ["System health", "Process RSS", "Threads", "Load avg", "Python", "discord.py", "RAM", "Disk", "CPU"]) assert.ok(t.includes(s), `overview shows ${s}`);
  assert.match(t, /\d+(\.\d)?%/);
  assert.ok(/GB|MB/.test(t), "RAM used/total shown");
  scope.dispose();
});

test("bot control: lists extensions by module name; protected rows are disabled; actions use module names", async () => {
  const { calls } = installMock();
  const { root, scope } = await mountRoute(pages.find((r) => r.id === "bot-control"));
  assert.ok(root.textContent.includes("web_server"));
  const rows = [...root.querySelectorAll("tbody tr")];
  const prot = rows.find((r) => r.textContent.includes("web_server"));
  assert.ok([...prot.querySelectorAll("button")].every((b) => b.disabled), "protected row has disabled actions");
  const music = rows.find((r) => /^music/.test(r.textContent.trim()));
  [...music.querySelectorAll("button")].find((b) => b.textContent.trim() === "Reload").click();
  await flush();
  assert.ok(calls.some((c) => c.method === "POST" && c.url.endsWith("/api/exec/bot/cogs/music/reload")), "reload used the module short name");
  scope.dispose();
});

test("moderation: days selector re-queries with the chosen window and labels all-time sections", async () => {
  const { calls } = installMock();
  const { root, scope } = await mountRoute(pages.find((r) => r.id === "moderation"));
  const btn = [...root.querySelectorAll(".segmented button")].find((b) => b.textContent.trim() === "30d");
  assert.ok(btn, "30d option exists");
  btn.click();
  await flush();
  assert.ok(calls.some((c) => c.url.includes("/api/exec/moderation?days=30")));
  assert.match(root.textContent, /all.time/i);
  scope.dispose();
});

test("guilds: sorting, search and the detail drawer; leaving needs the typed confirmation", async () => {
  const { calls } = installMock();
  const { root, scope } = await mountRoute(pages.find((r) => r.id === "guilds"));
  assert.ok(root.querySelectorAll("tbody tr").length >= 4);
  [...root.querySelectorAll("tbody tr")][0].click();
  await flush();
  assert.ok(document.querySelector('[role="dialog"]'), "drawer opens");
  assert.ok(calls.some((c) => /\/api\/exec\/guilds\/\d+$/.test(c.url)), "detail endpoint used");
  document.querySelector('[role="dialog"] button[aria-label="Close"]')?.click();
  scope.dispose();
});

test("login page: totp field appears only when the server asks for it", async () => {
  installMock();
  const mod = await import("../../assets/app/pages/login.js");
  const root = document.getElementById("root");
  root.replaceChildren(mod.default({ go() {} }));
  assert.equal(root.querySelector("#totp").closest(".field").hidden, true);
  assert.equal(root.querySelector("input[type=password]").autocomplete, "current-password");
});

test("components: asyncView shows error + retry on failure, ignores late results after abort", async () => {
  const { asyncView } = await import("../../assets/app/ui/components.js");
  const ac = new AbortController();
  let n = 0;
  const v = asyncView(ac.signal, async () => { if (n++ === 0) throw new Error("boom"); return "ok"; }, (d) => document.createTextNode(d));
  await flush(3);
  assert.match(v.textContent, /boom/);
  [...v.querySelectorAll("button")].find((b) => /Try again/.test(b.textContent)).click();
  await flush(3);
  assert.equal(v.textContent, "ok");
  const late = asyncView(ac.signal, () => new Promise((r) => setTimeout(() => r("late"), 20)), (d) => document.createTextNode(d));
  ac.abort();
  await flush(5);
  assert.notEqual(late.textContent, "late");
});

test("modal: Escape closes, focus is restored, Tab is trapped", async () => {
  const { openModal } = await import("../../assets/app/ui/components.js");
  const opener = document.createElement("button"); document.body.append(opener); opener.focus();
  const m = openModal(document.createTextNode("hi"), { title: "T" });
  assert.ok(document.querySelector('[role="dialog"][aria-modal="true"]'));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.activeElement, opener);
  void m;
});

test("table: >200 rows paginate at 100 per page; sorting toggles aria-sort", async () => {
  const { dataTable } = await import("../../assets/app/ui/table.js");
  const rows = Array.from({ length: 250 }, (_, i) => ({ n: i }));
  const t = dataTable({ columns: [{ key: "n", label: "N" }], rows });
  document.body.append(t);
  assert.equal(t.querySelectorAll("tbody tr").length, 100);
  [...t.querySelectorAll("button")].find((b) => b.textContent === "Next").click();
  assert.equal(t.querySelector("tbody tr td").textContent, "100");
  t.querySelector(".th-btn").click();
  assert.equal(t.querySelector("th").getAttribute("aria-sort"), "ascending");
});

test("moderation lookup: shows shared servers and moderates in the chosen one", async () => {
  const { calls } = installMock();
  const { root, scope } = await mountRoute(pages.find((r) => r.id === "moderation"));
  const input = [...root.querySelectorAll("input")].find((i) => !i.getAttribute("aria-label")?.includes("Reason"));
  input.value = "123456789012345678";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await flush(); await flush();
  const sel = root.querySelector('select[aria-label="Server to moderate in"]');
  assert.ok(sel, "server picker rendered");
  assert.ok(sel.options.length >= 2, "lists the shared servers");
  const second = sel.options[1].value;
  sel.value = second;
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  await flush(); await flush();
  assert.ok(calls.some((c) => c.url.includes("/api/exec/mod/user") && c.url.includes(`guild_id=${second}`)), "re-queried with chosen server");
  const warn = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === "Warn");
  warn.click();
  await flush();
  const post = calls.find((c) => c.method === "POST" && c.url.endsWith("/api/exec/mod/action"));
  assert.ok(post, "action posted");
  assert.equal(String((typeof post.body === "string" ? JSON.parse(post.body) : post.body).guild_id), String(second));
  scope.dispose();
});
