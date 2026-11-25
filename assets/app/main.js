/* App shell: boot, auth gate, router, lazy page mounting. */
import { h, mount, createScope } from "./core/dom.js";
import { createRouter } from "./core/router.js";
import { auth, restore, can, lostSession } from "./core/auth.js";
import { onAuthLost } from "./core/api.js";
import { applyPrefs } from "./core/prefs.js";
import { ROUTES } from "./routes.js";

applyPrefs();
const root = document.getElementById("root");
let layout = null, layoutP = null;
let page = null; // { scope }
let navId = 0;

const dashboardUrl = () => String(globalThis.STAFF_CONFIG?.dashboardUrl || "https://dash.rift.cool").replace(/\/+$/, "");

const router = createRouter({ routes: ROUTES, onChange: () => render() });
const go = (p) => router.go(p);
globalThis.__staff = { go };

function bootScreen(text, extra) {
  mount(root, h("div", { class: "boot", role: "status" }, h("img", { class: "boot-logo", src: "/assets/riftlogo.jpg", alt: "", width: 48, height: 48 }), h("p", null, text), extra));
}

function disposePage() {
  page?.scope.dispose();
  page = null;
}

function makeCtx(scope, rc, route) {
  const user = auth.get().user;
  return { scope, signal: scope.signal, user, can, go, query: rc.query, params: rc.params, route, permission: route.perm };
}

async function render() {
  const rc = router.current();
  if (!rc) return;
  const { status } = auth.get();
  const route = rc.route || ROUTES.at(-1);
  const id = ++navId;

  if (route.legacyAppeal) { location.replace(`${dashboardUrl()}/appeals/thread/${encodeURIComponent(rc.params.token || "")}`); return; }
  if (status === "loading") return bootScreen("Loading…");
  if (status === "offline") { disposePage(); return bootScreen("Can't reach the Rift backend. Retrying…", h("button", { class: "btn", type: "button", onClick: () => restore() }, "Retry now")); }

  if (status === "anon") {
    disposePage();
    layout?.destroy(); layout = layoutP = null;
    if (route.id !== "login") return router.replace("/login");
    const scope = createScope();
    page = { scope };
    const mod = await route.load();
    if (id !== navId) return;
    mount(root, mod.default({ go, scope, signal: scope.signal }));
    document.title = "Sign in · Rift Staff";
    return;
  }

  // authed
  if (route.id === "login") return router.replace("/");
  if (route.notFound) return router.replace("/");
  disposePage();
  if (!layout) {
    layoutP ||= import("./layout.js");
    const lm = await layoutP;
    if (id !== navId) return;
    layout = lm.createLayout({ go, user: auth.get().user, can });
    mount(root, layout.el);
  }
  layout.setActive(rc.path);
  const scope = createScope();
  page = { scope };
  const ctx = makeCtx(scope, rc, route);
  document.title = `${route.label} · Rift Staff`;
  layout.setBusy(true);
  let node;
  if (route.perm && !can(route.perm)) {
    const mod = await import("./pages/forbidden.js");
    node = mod.default(ctx);
  } else {
    try {
      const mod = await route.load();
      if (id !== navId) return;
      node = mod.default(ctx);
    } catch (e) {
      console.error(e);
      node = h("div", { class: "error-state", role: "alert" }, h("strong", null, "This page failed to load"), h("p", null, e.message));
    }
  }
  if (id !== navId) { scope.dispose(); return; }
  layout.setPage(node);
  layout.setBusy(false);
}

onAuthLost(() => lostSession());
let lastStatus = null;
auth.subscribe(({ status }) => {
  if (status !== lastStatus) {
    lastStatus = status;
    if (router.current()) render();
  }
});

(async () => {
  if (globalThis.STAFF_DEMO) (await import("./demo/mock.js")).installMockBackend();
  restore();
  router.start();
})();
