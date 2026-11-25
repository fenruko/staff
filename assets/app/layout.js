/* Authenticated chrome: sidebar, topbar, banners, shortcuts, live badges. */
import { h, mount, rafBatch } from "./core/dom.js";
import { api, getApiBase, onNetworkChange, isBackendDown, backendDownRemaining } from "./core/api.js";
import { connectExecSocket } from "./core/ws.js";
import { logout } from "./core/auth.js";
import { prefs, setPref } from "./core/prefs.js";
import { fetchLatestPost, isUsable, markSeen, readSeen, postUrl, bannerUrl } from "./core/blog.js";
import { NAV } from "./routes.js";
import { icon } from "./ui/icons.js";
import { toast } from "./ui/components.js";

const GROUPS = ["Monitor", "Community", "Analytics", "Bot", "Admin"];
const isTyping = (t) => t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function createLayout({ go, user, can }) {
  const items = NAV.filter((r) => can(r.perm));
  const badges = { appeals: 0, bugreports: 0, economy: 0 };
  const badgeEls = {};
  let open = false;

  /* ---- sidebar ---- */
  const navLinks = new Map();
  const nav = h("nav", { class: "sidebar-nav", "aria-label": "Main" }, GROUPS.map((g) => {
    const rs = items.filter((r) => r.group === g);
    if (!rs.length) return null;
    return h("div", { class: "nav-group" }, h("div", { class: "nav-group-label" }, g), rs.map((r) => {
      const b = h("span", { class: "nav-badge", hidden: true });
      badgeEls[r.id] = b;
      const a = h("a", { class: "nav-item", href: r.path, onClick: () => close() }, icon(r.icon, 17), h("span", { class: "grow" }, r.label), b);
      navLinks.set(r.path, a);
      return a;
    }));
  }), can("blog.post") ? h("a", { class: "nav-item", href: "https://rift.cool/blog/new", target: "_blank", rel: "noopener noreferrer", "data-external": "true" }, icon("message", 17), h("span", { class: "grow" }, "Write a blog post"), icon("external", 13)) : null);

  const lookupInput = h("input", { class: "input input--sm", placeholder: "Look up user ID…", "aria-label": "Look up user ID", autocomplete: "off" });
  const lookup = h("form", { class: "sidebar-search", onSubmit: (e) => {
    e.preventDefault();
    const id = lookupInput.value.trim();
    if (!id) return;
    close();
    if (can("economy.manage")) go(`/economy?u=${encodeURIComponent(id)}`);
    else if (can("blacklist.manage")) go(`/blacklist?u=${encodeURIComponent(id)}`);
    lookupInput.value = "";
  } }, lookupInput);

  const sidebar = h("aside", { class: "sidebar", "aria-label": "Sidebar" },
    h("div", { class: "sidebar-brand" }, h("img", { class: "brand-logo", src: "/assets/riftlogo.jpg", alt: "", width: 28, height: 28 }), h("span", { class: "brand-name" }, "rift", h("em", null, "staff"))),
    can("economy.manage") || can("blacklist.manage") ? lookup : null, nav,
    h("div", { class: "sidebar-foot" },
      h("div", { class: "sidebar-user" }, h("span", { class: "avatar avatar--fallback" }, user.username.slice(0, 2).toUpperCase()), h("span", { class: "grow" }, h("strong", null, user.username), h("small", { class: "muted block" }, user.role || "Staff member"))),
      h("div", { class: "row" }, h("button", { type: "button", class: "btn btn--ghost btn--sm grow", onClick: async () => (await import("./ui/palette.js")).openGuide() }, icon("book", 14), "Guide"),
        h("button", { type: "button", class: "btn btn--ghost btn--sm grow", onClick: () => logout() }, icon("logout", 14), "Sign out"))));
  const scrim = h("div", { class: "scrim", onClick: () => close() });
  function setOpen(v) { open = v; document.body.classList.toggle("nav-open", v); menuBtn.setAttribute("aria-expanded", String(v)); }
  const close = () => setOpen(false);

  /* ---- topbar ---- */
  const menuBtn = h("button", { type: "button", class: "btn btn--ghost btn--icon menu-btn", "aria-label": "Open navigation", "aria-expanded": "false", onClick: () => setOpen(!open) }, icon("menu", 18));
  const conn = h("span", { class: "pill", title: "Live connection" }, h("i", { class: "dot" }), "Offline");
  const themeBtn = h("button", { type: "button", class: "btn btn--ghost btn--icon", onClick: () => setPref({ theme: prefs.get().theme === "light" ? "dark" : "light" }) });
  const densBtn = h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => setPref({ density: prefs.get().density === "compact" ? "comfortable" : "compact" }) });
  const paintPrefs = () => {
    const p = prefs.get();
    themeBtn.replaceChildren(icon(p.theme === "light" ? "moon" : "sun", 16));
    themeBtn.setAttribute("aria-label", p.theme === "light" ? "Switch to dark theme" : "Switch to light theme");
    densBtn.textContent = p.density === "compact" ? "Compact" : "Comfortable";
    densBtn.setAttribute("aria-label", `Density: ${densBtn.textContent}. Click to toggle.`);
  };
  paintPrefs();
  const offPrefs = prefs.subscribe(paintPrefs);
  const palette = async () => { const m = await import("./ui/palette.js"); m.openPalette({ items: items.map((r) => ({ label: r.label, icon: r.icon, hint: `g ${r.key}`, path: r.path })), onPick: (it) => go(it.path) }); };
  const topbar = h("header", { class: "topbar" }, menuBtn,
    h("button", { type: "button", class: "search-trigger", onClick: palette, "aria-label": "Open command palette" }, icon("search", 15), h("span", { class: "grow" }, "Jump to…"), h("kbd", null, /Mac/.test(navigator.platform) ? "⌘K" : "Ctrl K")),
    h("div", { class: "topbar-actions" }, conn, densBtn, themeBtn));

  /* ---- banner ---- */
  const banner = h("div", { class: "banner", role: "status", hidden: true });
  let bannerTimer = null;
  const paintBanner = () => {
    clearInterval(bannerTimer);
    const offline = navigator.onLine === false;
    if (!offline && !isBackendDown()) { banner.hidden = true; return; }
    const set = () => { banner.textContent = offline ? "You're offline. Reconnecting when your network returns." : `Can't reach the Rift backend. Retrying in ${Math.ceil(backendDownRemaining() / 1000)}s…`; if (!offline && !isBackendDown()) paintBanner(); };
    banner.hidden = false; set();
    bannerTimer = setInterval(set, 1000);
  };
  const offNet = onNetworkChange(paintBanner);
  addEventListener("online", paintBanner); addEventListener("offline", paintBanner);

  /* ---- main ---- */
  const main = h("main", { id: "main", class: "main", tabindex: "-1" });
  const el = h("div", { class: "app" }, sidebar, scrim, h("div", { class: "shell" }, topbar, banner, main));
  const blog = h("div", { class: "blog-root", role: "region", "aria-label": "Blog updates", "aria-live": "polite" });
  el.append(blog);

  /* ---- live badges + blog notices (one shared socket) ---- */
  const paintBadges = rafBatch(() => { for (const [k, el2] of Object.entries(badgeEls)) { const n = badges[k === "appeals" ? "appeals" : k === "bugreports" ? "bugreports" : k === "economy" ? "economy" : ""] ?? 0; el2.hidden = !n; el2.textContent = n > 99 ? "99+" : String(n); } });
  const count = (key, fn) => () => fn().then((r) => { badges[key] = Array.isArray(r) ? r.length : 0; paintBadges(); }).catch(() => {});
  const refreshers = {
    appeals: can("appeals.view") && count("appeals", () => api.listAppeals("open")),
    bugreports: can("bugreports.view") && count("bugreports", () => api.listBugReports("open")),
    economy: can("economy.manage") && count("economy", () => api.economyInbox("pending")),
  };
  for (const r of Object.values(refreshers)) r?.();
  const showPost = (post) => {
    if (!isUsable(post) || readSeen().includes(post.id)) return;
    markSeen(post.id);
    const card = h("div", { class: "blog-card", role: "status" },
      post.banner_id ? h("img", { src: bannerUrl(getApiBase(), post.banner_id), alt: "", width: 56, height: 56, loading: "lazy" }) : h("span", { class: "blog-ph" }, icon("message", 20)),
      h("div", { class: "grow" }, h("small", { class: "eyebrow" }, "New on the Rift blog"), h("strong", { class: "block" }, post.title), post.excerpt ? h("span", { class: "muted small clamp" }, post.excerpt) : null,
        h("a", { href: postUrl(post), target: "_blank", rel: "noopener noreferrer", "data-external": "true", onClick: () => card.remove() }, "Read the post")),
      h("button", { type: "button", class: "btn btn--ghost btn--icon", "aria-label": "Dismiss", onClick: () => card.remove() }, icon("close", 14)));
    blog.append(card);
    while (blog.children.length > 3) blog.firstChild.remove();
    setTimeout(() => card.remove(), 16000);
  };
  fetchLatestPost().then((p) => p && showPost(p));
  const offSock = connectExecSocket((m) => {
    const t = m.type || "";
    if (t.startsWith("appeal_")) refreshers.appeals?.();
    else if (t.startsWith("bugreport_")) refreshers.bugreports?.();
    else if (t.startsWith("economy_adjustment")) refreshers.economy?.();
    else if (t === "blog_post") showPost(m.data);
  }, (s) => { conn.className = `pill ${s === "connected" ? "pill--ok" : s === "connecting" ? "pill--warn" : ""}`; conn.lastChild.textContent = s === "connected" ? "Live" : s === "connecting" ? "Connecting" : "Offline"; });

  /* ---- shortcuts ---- */
  let gPending = 0;
  const onKey = async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector(".overlay")) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "?") { e.preventDefault(); (await import("./ui/palette.js")).openShortcuts(items); return; }
    if (e.key === "/" && lookupInput.isConnected) { e.preventDefault(); close(); setOpen(true); lookupInput.focus(); return; }
    if (gPending && Date.now() - gPending < 1200) {
      gPending = 0;
      const r = items.find((i) => i.key === e.key.toLowerCase());
      if (r) { e.preventDefault(); go(r.path); }
      return;
    }
    gPending = e.key === "g" ? Date.now() : 0;
  };
  document.addEventListener("keydown", onKey);

  return {
    el, main,
    setActive(path) { for (const [p, a] of navLinks) { const on = p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`); a.classList.toggle("active", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); } close(); },
    setBusy(b) { main.setAttribute("aria-busy", String(b)); },
    setPage(node) { mount(main, h("div", { class: "page" }, node)); main.scrollTop = 0; scrollTo(0, 0); main.focus({ preventScroll: true }); },
    destroy() { document.removeEventListener("keydown", onKey); offSock(); offNet(); offPrefs(); clearInterval(bannerTimer); removeEventListener("online", paintBanner); removeEventListener("offline", paintBanner); document.body.classList.remove("nav-open"); },
  };
}
