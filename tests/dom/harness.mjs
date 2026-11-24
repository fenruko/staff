/* jsdom + in-browser mock backend, so pages mount exactly as main.js mounts them. */
import { JSDOM } from "jsdom";
import { createMock } from "../../assets/app/demo/mock.js";
import { createScope } from "../../assets/app/core/dom.js";
import { hasPermission } from "../../assets/app/core/auth.js";

export function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "https://staff.test/", pretendToBeVisual: true });
  const w = dom.window;
  const g = { window: w, document: w.document, navigator: w.navigator, location: w.location, history: w.history, localStorage: w.localStorage, sessionStorage: w.sessionStorage,
    Node: w.Node, HTMLElement: w.HTMLElement, Element: w.Element, Event: w.Event, KeyboardEvent: w.KeyboardEvent, MouseEvent: w.MouseEvent, CustomEvent: w.CustomEvent,
    getComputedStyle: w.getComputedStyle.bind(w), requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0), cancelAnimationFrame: clearTimeout,
    URL: w.URL, Blob: w.Blob, DOMException: w.DOMException, FormData: w.FormData, File: w.File, FileReader: w.FileReader };
  for (const [k, v] of Object.entries(g)) { try { globalThis[k] = v; } catch { /* read-only */ } }
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.STAFF_CONFIG = { apiBase: "https://api.test" };
  return dom;
}

export function installMock({ token = "demo-token" } = {}) {
  const mock = createMock();
  localStorage.setItem("rift_staff_token", token);
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method || "GET", url: String(url), body });
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { status, data } = mock.handle(init.method || "GET", url, body, init.headers || {});
    return { ok: status < 400, status, json: async () => data };
  };
  return { mock, calls };
}

export const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 12)); };

export const USERS = {
  admin: { id: 1, username: "demo_admin", role: "Founder", permissions: ["*"] },
  limited: { id: 2, username: "mira", role: "Support Lead", permissions: ["overview.view", "moderation.view"] },
};

/** Mount a route's page like main.js does (permission gate included). */
export async function mountRoute(route, { user = USERS.admin, query = {}, params = {} } = {}) {
  const root = document.getElementById("root");
  root.replaceChildren();
  const scope = createScope();
  const can = (p) => hasPermission(user, p);
  const ctx = { scope, signal: scope.signal, user, can, go() {}, query, params, route, permission: route.perm };
  const mod = route.perm && !can(route.perm) ? await import("../../assets/app/pages/forbidden.js") : await route.load();
  const node = mod.default(ctx);
  root.append(node);
  await flush();
  return { root, scope, node };
}
