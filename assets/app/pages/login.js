import { h } from "../core/dom.js";
import { login } from "../core/auth.js";

export default function loginPage({ go }) {
  let needsTotp = false;
  const err = h("p", { class: "form-error", role: "alert" });
  const mk = (id, label, o) => h("div", { class: "field" }, h("label", { class: "field-label", for: id }, label), h("input", { id, class: "input", required: true, ...o }));
  const totpField = mk("totp", "Authenticator code", { inputmode: "numeric", autocomplete: "one-time-code", maxlength: 8, placeholder: "123456", required: false });
  totpField.hidden = true;
  const submit = h("button", { class: "btn btn--primary btn--full", type: "submit" }, "Sign in");
  const form = h("form", { class: "login-card", onSubmit: async (e) => {
    e.preventDefault();
    err.textContent = "";
    submit.disabled = true;
    const v = (id) => form.querySelector(`#${id}`).value;
    try {
      await login(v("username").trim(), v("password"), needsTotp ? v("totp").trim() : undefined);
      go("/");
    } catch (x) {
      if (x.body?.totp_required) { needsTotp = true; totpField.hidden = false; form.querySelector("#totp").required = true; form.querySelector("#totp").focus(); err.textContent = "Enter the code from your authenticator app."; }
      else err.textContent = x.message;
    } finally { submit.disabled = false; }
  } },
    h("h1", { class: "login-title" }, "Sign in"), h("p", { class: "muted" }, "Staff accounts only."),
    mk("username", "Username", { autocomplete: "username", autofocus: true }), mk("password", "Password", { type: "password", autocomplete: "current-password" }),
    totpField, err, submit);
  return h("main", { id: "main", class: "login" },
    h("div", { class: "login-brand" }, h("img", { src: "/assets/riftlogo.jpg", alt: "", width: 48, height: 48 }), h("span", null, "rift ", h("em", null, "staff"))),
    form);
}
