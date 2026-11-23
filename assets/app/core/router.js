/* Tiny History-API router. Routes are {path, ...anything}; this module only
 * matches, navigates and intercepts same-origin links. */

export function compilePath(pattern) {
  const clean = String(pattern || "/").replace(/\/+$/, "") || "/";
  const keys = [];
  const src = clean
    .split("/")
    .map((seg) => {
      if (!seg) return "";
      if (seg === "*") { keys.push("wildcard"); return "(.*)"; }
      if (seg[0] === ":") { keys.push(seg.slice(1)); return "([^/]+)"; }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${src}/?$`), keys };
}

export function matchRoute(routes, pathname) {
  for (const route of routes) {
    const { regex, keys } = compilePath(route.path);
    const m = regex.exec(pathname || "/");
    if (!m) continue;
    const params = {};
    keys.forEach((k, i) => {
      try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = m[i + 1]; }
    });
    return { route, params };
  }
  return null;
}

export function createRouter({ routes, onChange }) {
  let current = null;

  function go(url, { replace = false } = {}) {
    const u = new URL(url, location.origin);
    const matched = matchRoute(routes, u.pathname);
    const ctx = {
      path: u.pathname,
      search: u.search,
      query: Object.fromEntries(u.searchParams),
      params: matched?.params || {},
      route: matched?.route || null,
    };
    const target = u.pathname + u.search + u.hash;
    if (location.pathname + location.search + location.hash !== target) history[replace ? "replaceState" : "pushState"](null, "", target);
    current = ctx;
    onChange(ctx);
    return ctx;
  }

  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target?.closest?.("a[href]");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const href = a.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    e.preventDefault();
    go(href);
  }

  return {
    start() {
      window.addEventListener("popstate", () => go(location.pathname + location.search, { replace: true }));
      document.addEventListener("click", onClick);
      return go(location.pathname + location.search, { replace: true });
    },
    go,
    replace: (url) => go(url, { replace: true }),
    current: () => current,
  };
}
