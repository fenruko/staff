import { h, mount } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, btn, badge, input, select, segmented, asyncView, toast, confirmDialog, field, empty } from "../ui/components.js";
import { dataTable } from "../ui/table.js";

export default function botControl(ctx) {
  const canControl = ctx.can("bot.control"), canRestart = ctx.can("bot.restart"), canShutdown = ctx.can("bot.shutdown"), canBroadcast = ctx.can("broadcast.send");
  const status = h("p", { class: "status-line", role: "status", "aria-live": "polite" });
  const say = (ok, text) => { status.textContent = text; status.className = `status-line ${ok ? "ok" : "bad"}`; toast(text, ok ? "success" : "error"); };
  const sections = [h("div", null, status)];

  if (canControl) {
    let exts = [], q = "", filter = "all", busy = new Set();
    const tableHost = h("div"), count = h("span", { class: "muted small" });
    const act = async (e, action) => {
      if (busy.has(e.name)) return;
      busy.add(e.name); draw();
      try {
        const fn = { load: api.loadCog, reload: api.reloadCog, unload: api.unloadCog }[action];
        const res = await fn(e.name, { signal: ctx.signal });
        say(true, res?.status || `${e.name}: ${action} done`);
      } catch (err) {
        if (err.name === "AbortError") return;
        say(false, `${e.name}: ${err.message}`); // server error text, verbatim
      } finally { busy.delete(e.name); }
      await fetchExts().catch(() => {});
    };
    const shown = () => exts.filter((e) => (filter === "all" || (filter === "loaded") === e.loaded) && (!q || `${e.name} ${(e.cogs || []).join(" ")}`.toLowerCase().includes(q)));
    function draw() {
      const rows = shown();
      count.textContent = `${exts.filter((e) => e.loaded).length} loaded · ${exts.filter((e) => !e.loaded).length} unloaded`;
      mount(tableHost, dataTable({ rows, emptyLabel: "No extensions match.", caption: "Extensions", initialSort: { key: "name", dir: 1 }, columns: [
        { key: "name", label: "Extension", render: (e) => h("span", null, h("strong", null, e.name), " ", h("small", { class: "muted" }, e.module)) },
        { key: "cogs", label: "Cogs", sortable: false, render: (e) => (e.cogs || []).join(", ") || "—" },
        { key: "loaded", label: "State", value: (e) => (e.loaded ? 1 : 0), render: (e) => h("span", null, badge(e.loaded ? "Loaded" : "Unloaded", e.loaded ? "success" : "neutral"), e.protected ? [" ", badge("Protected", "warning")] : null) },
        { key: "_a", label: "", sortable: false, align: "right", render: (e) => h("div", { class: "row end" },
          e.loaded ? btn("Reload", { sm: true, disabled: busy.has(e.name), onClick: () => act(e, "reload") }) : btn("Load", { sm: true, variant: "primary", disabled: busy.has(e.name), onClick: () => act(e, "load") }),
          e.loaded ? btn("Unload", { sm: true, variant: "danger-ghost", disabled: busy.has(e.name) || e.protected, title: e.protected ? "Protected extension" : null, onClick: () => act(e, "unload") }) : null) }] }));
    }
    async function fetchExts() {
      const r = await api.botExtensions({ signal: ctx.signal });
      exts = r?.extensions || [];
      draw();
    }
    const extView = asyncView(ctx.signal, fetchExts, () => h("div", null, tableHost));
    const bar = h("div", { class: "toolbar" },
      segmented([["all", "All"], ["loaded", "Loaded"], ["unloaded", "Unloaded"]], filter, (v) => { filter = v; draw(); }, "State filter"),
      input({ type: "search", placeholder: "Search extensions…", "aria-label": "Search extensions", onInput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } }), count);

    // maintenance
    const maint = asyncView(ctx.signal, () => api.getMaintenance({ signal: ctx.signal }), (m) => {
      const on = h("input", { type: "checkbox", checked: !!m.maintenance, id: "maint-on" });
      const msg = input({ value: m.message || "", placeholder: "Message shown to users while in maintenance", "aria-label": "Maintenance message" });
      return h("div", { class: "stack" }, h("label", { class: "check" }, on, "Enable maintenance mode"), msg,
        h("div", null, btn("Save", { variant: "primary", onClick: async () => { try { await api.setMaintenance(on.checked, msg.value, { signal: ctx.signal }); say(true, "Maintenance settings saved"); } catch (e) { say(false, e.message); } } })));
    }, 2);
    sections.push(card("Maintenance mode", null, maint), card("Extensions", { sub: "Load, reload or unload cog modules", actions: bar }, extView));
  }

  if (canBroadcast) {
    const msg = h("textarea", { class: "textarea", rows: 3, placeholder: "Message to send…", "aria-label": "Broadcast message" });
    const target = input({ value: "all", placeholder: "all, or a specific guild ID", "aria-label": "Broadcast target" });
    const send = btn("Send broadcast", { variant: "primary", onClick: async () => {
      if (!msg.value.trim()) return;
      send.disabled = true;
      try { const r = await api.broadcast(msg.value, target.value.trim() || "all", { signal: ctx.signal }); say(true, `Sent to ${r.sent ?? 0} channel(s), ${r.failed ?? 0} failed`); msg.value = ""; }
      catch (e) { say(false, e.message); } finally { send.disabled = false; }
    } });
    sections.push(card("Broadcast a message", null, h("div", { class: "stack" }, msg, h("div", { class: "row" }, target, send))));
  }

  if (canRestart || canShutdown) {
    const danger = (label, word, title, description, fn, done) => btn(label, { variant: "danger", onClick: async () => {
      if (!(await confirmDialog({ title, description, confirmWord: word, confirmLabel: label }))) return;
      try { await fn({ signal: ctx.signal }); } catch { /* the process may drop the connection while stopping */ }
      say(true, done);
    } });
    sections.push(card("Danger zone", { class: "card--danger" }, h("div", { class: "row" },
      canRestart ? danger("Restart bot", "RESTART", "Restart the bot?", "The whole process will restart. It should come back within a few seconds under a process manager.", api.restartBot, "Restart triggered.") : null,
      canShutdown ? danger("Shut down bot", "SHUTDOWN", "Shut down the bot?", "The bot goes fully offline and will NOT restart on its own.", api.shutdownBot, "Shutdown triggered.") : null)));
  }
  return h("div", { class: "stack" }, pageHead("Bot Control"), ...sections);
}
