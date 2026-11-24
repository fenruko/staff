import { h, mount } from "../core/dom.js";
import { api } from "../core/api.js";
import { pageHead, card, btn, input, field, badge, toast, asyncView, openModal, confirmDialog, empty } from "../ui/components.js";
import { donut } from "../ui/charts.js";
import { dataTable } from "../ui/table.js";
import { memberInput } from "../ui/member-input.js";
import { fmtDateTime } from "../core/format.js";

/** The catalog is [{key,label,category}] (an object map {key: label} is tolerated). */
export function normalizeCatalog(c) {
  if (Array.isArray(c)) return c;
  return Object.entries(c || {}).map(([key, label]) => ({ key, label: String(label), category: key.split(".")[0] }));
}

function permissionEditor(catalog, selected, disabled, onChange) {
  const root = h("div", { class: "stack" });
  const draw = () => {
    const full = selected.includes("*");
    const cats = {};
    for (const p of catalog) (cats[p.category] ||= []).push(p);
    mount(root,
      h("label", { class: "check box" }, h("input", { type: "checkbox", checked: full, disabled, onChange: (e) => { selected = e.target.checked ? ["*"] : []; onChange(selected); draw(); } }), h("strong", null, "Full access (everything, always)")),
      h("div", { class: ["perm-groups", full && "dim"] }, Object.entries(cats).map(([cat, ps]) => h("fieldset", { class: "perm-group" }, h("legend", null, cat),
        h("div", { class: "perm-grid" }, ps.map((p) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: full || selected.includes(p.key), disabled: disabled || full, onChange: () => {
          selected = selected.includes(p.key) ? selected.filter((k) => k !== p.key) : [...selected, p.key]; onChange(selected); }, "aria-label": p.key }), p.label))))))
    );
  };
  draw();
  return root;
}

function staffForm(ctx, { catalog, existing, onSaved }) {
  const isEdit = !!existing, me = ctx.user, isSelf = isEdit && me && existing.id === me.id;
  const isSuper = (me?.permissions || []).includes("*");
  // Only offer permissions you hold yourself; the server enforces the same rule.
  const grantable = isSuper ? catalog : catalog.filter((p) => (me?.permissions || []).includes(p.key));
  let perms = [...(existing?.permissions || [])], discord = existing?.discord_id ? String(existing.discord_id) : "";
  const username = input({ value: existing?.username || "", autocomplete: "off", "aria-label": "Username" }), password = input({ type: "password", autocomplete: "new-password", "aria-label": "Password" });
  const role = input({ value: existing?.role || "Staff", placeholder: "e.g. Founder, Support Lead, Night Mod", "aria-label": "Role" });
  const picker = memberInput({ value: discord, onChange: (v) => { discord = v; }, signal: ctx.signal });
  const err = h("p", { class: "status-line bad", role: "alert" });
  const save = btn(isEdit ? "Save changes" : "Create account", { variant: "primary" });
  save.addEventListener("click", async () => {
    err.textContent = "";
    if (!isEdit && (!username.value.trim() || !password.value)) { err.textContent = "Username and password are required."; return; }
    save.disabled = true;
    try {
      if (isEdit) {
        const payload = { role: role.value, discord_id: discord };
        if (!isSelf) payload.permissions = perms; // self edits never send permissions
        if (password.value) payload.password = password.value;
        await api.updateStaff(existing.id, payload, { signal: ctx.signal });
      } else await api.createStaff({ username: username.value.trim(), password: password.value, role: role.value, permissions: perms, discord_id: discord }, { signal: ctx.signal });
      m.close(); onSaved();
    } catch (e) { if (e.name !== "AbortError") err.textContent = e.message; save.disabled = false; }
  });
  const m = openModal(h("div", { class: "stack" },
    isEdit ? null : field("Username", username), field(isEdit ? "New password (leave blank to keep current)" : "Password", password),
    field("Discord account (links dashboard permissions to bot-wide commands)", picker), field("Display role / title", role),
    h("div", null, h("span", { class: "field-label" }, "Permissions"), permissionEditor(grantable, perms, isSelf, (p) => { perms = p; }),
      isSelf ? h("p", { class: "field-help warn" }, "You can't edit your own permissions; ask another staff.manage holder.") : null),
    err, h("div", { class: "row end" }, btn("Cancel", { variant: "ghost", onClick: () => m.close() }), save)), { title: isEdit ? `Edit ${existing.username}` : "New staff account", wide: true });
}

export default function staff(ctx) {
  if (!ctx.can("staff.manage")) return h("p", { class: "empty" }, "You don't have the staff.manage permission, so you can't view or edit staff accounts.");
  let catalog = [];
  const view = asyncView(ctx.signal, async () => { const [s, c] = await Promise.all([api.listStaff({ signal: ctx.signal }), api.permissionCatalog({ signal: ctx.signal })]); catalog = normalizeCatalog(c); return s; }, (list) => {
    list = Array.isArray(list) ? list : [];
    const del = async (s) => { if (!(await confirmDialog({ title: `Delete ${s.username}?`, description: "This immediately revokes their access. This can't be undone.", confirmWord: s.username, confirmLabel: "Delete account" }))) return;
      try { await api.deleteStaff(s.id, { signal: ctx.signal }); toast("Account deleted", "success"); view.reload(); } catch (e) { toast(e.message, "error"); } };
    return h("div", { class: "stack" },
      list.length ? card("2FA coverage", { sub: "Staff accounts with a TOTP secret enabled" }, donut([{ name: "2FA enabled", value: list.filter((s) => s.totp_enabled).length }, { name: "No 2FA", value: list.filter((s) => !s.totp_enabled).length }], { centerLabel: "Accounts", label: "2FA coverage" })) : null,
      card(`Accounts (${list.length})`, null, dataTable({ rows: list, emptyLabel: "No staff accounts.", columns: [
        { key: "username", label: "Username", render: (s) => h("span", null, s.username, s.username === ctx.user?.username ? h("small", { class: "muted" }, " (you)") : null) },
        { key: "role", label: "Role" },
        { key: "permissions", label: "Permissions", value: (s) => (s.permissions.includes("*") ? 999 : s.permissions.length), render: (s) => (s.permissions.includes("*") ? badge("Full access", "warning") : `${s.permissions.length} permission${s.permissions.length === 1 ? "" : "s"}`) },
        { key: "totp_enabled", label: "2FA", render: (s) => (s.totp_enabled ? "Enabled" : "Off"), value: (s) => (s.totp_enabled ? 1 : 0) },
        { key: "last_login", label: "Last login", render: (s) => (s.last_login ? fmtDateTime(s.last_login) : "Never"), value: (s) => Number(s.last_login) || 0 },
        { key: "_a", label: "", sortable: false, align: "right", render: (s) => h("div", { class: "row end" }, btn("Edit", { sm: true, onClick: () => staffForm(ctx, { catalog, existing: s, onSaved: () => view.reload() }) }),
          s.username !== ctx.user?.username ? btn("Delete", { sm: true, variant: "danger-ghost", onClick: () => del(s) }) : null) }] })));
  });
  return h("div", { class: "stack" }, pageHead("Staff Management", { actions: btn("New staff account", { variant: "primary", onClick: () => staffForm(ctx, { catalog, existing: null, onSaved: () => view.reload() }) }) }), view);
}
