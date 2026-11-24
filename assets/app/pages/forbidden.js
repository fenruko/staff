import { h } from "../core/dom.js";
import { pageHead } from "../ui/components.js";

export default function forbidden(ctx) {
  const perms = [].concat(ctx.permission || []);
  return h("div", { class: "stack" }, pageHead("Not allowed"),
    h("div", { class: "card forbidden", role: "alert" }, h("p", null, "You don't have the ", perms.map((p, i) => [i ? " or " : "", h("code", null, p)]), " permission needed to view this page. Ask someone with ", h("code", null, "staff.manage"), " to grant it.")));
}
