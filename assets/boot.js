/* Classic script, runs before the module graph: restores deep links stashed by
 * 404.html, applies the saved theme without a flash, and sets the CSP so
 * connections are limited to this origin plus the configured API host. */
(function () {
  try {
    var r = sessionStorage.redirect;
    delete sessionStorage.redirect;
    if (r && r !== location.pathname + location.search + location.hash) history.replaceState(null, "", r);
  } catch (e) { /* storage disabled: the app still works at "/" */ }
  try {
    var p = JSON.parse(localStorage.getItem("rift_staff_prefs") || "{}");
    if (p.theme === "light") document.documentElement.dataset.theme = "light";
    if (p.density === "compact") document.documentElement.dataset.density = "compact";
  } catch (e) { /* defaults */ }
  var cfg = window.STAFF_CONFIG || {};
  var api = "https://api.rift.cool";
  try { api = new URL(cfg.apiBase || api, location.origin).origin; } catch (e) { /* keep default */ }
  var ws = api.replace(/^http/, "ws");
  var demo = !!cfg.demo || /[?&]demo=1\b/.test(location.search);
  try { if (demo) sessionStorage.riftDemo = "1"; demo = demo || sessionStorage.riftDemo === "1"; } catch (e) { /* ignore */ }
  window.STAFF_DEMO = demo;
  var csp = [
    "default-src 'none'", "script-src 'self'", "style-src 'self'", "font-src 'self'",
    "img-src 'self' data: blob: https://cdn.discordapp.com https://media.discordapp.net " + api,
    "connect-src 'self' " + api + " " + ws, "object-src 'none'", "base-uri 'none'", "form-action 'self'",
  ].join("; ");
  var m = document.createElement("meta");
  m.httpEquiv = "Content-Security-Policy";
  m.content = csp;
  document.head.appendChild(m);
})();
