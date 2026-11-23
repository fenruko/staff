/* Minimal DOM toolkit. Text is always set via textContent / text nodes, never
 * innerHTML, so strings from the bot API can't inject markup. */

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "g", "line", "polyline", "polygon", "text", "defs", "linearGradient", "stop", "title"]);
const BOOL = new Set(["disabled", "checked", "selected", "readOnly", "required", "multiple", "autofocus", "hidden"]);

export function cx(...parts) {
  const out = [];
  for (const p of parts) {
    if (!p) continue;
    if (typeof p === "string") out.push(p);
    else if (Array.isArray(p)) out.push(cx(...p));
    else for (const [k, v] of Object.entries(p)) if (v) out.push(k);
  }
  return out.join(" ");
}

export function h(tag, props, ...kids) {
  const svg = SVG_TAGS.has(tag);
  const el = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  if (props != null && (typeof props !== "object" || props instanceof Node || Array.isArray(props))) {
    kids.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") {
      const c = cx(v);
      if (c) el.setAttribute("class", c);
    } else if (k === "style") {
      if (typeof v === "string") el.style.cssText = v;
      else for (const [p, val] of Object.entries(v)) {
        if (val == null) continue;
        if (p.startsWith("--")) el.style.setProperty(p, String(val));
        else el.style[p] = val;
      }
    } else if (k === "dataset") {
      for (const [p, val] of Object.entries(v)) if (val != null) el.dataset[p] = String(val);
    } else if (k === "ref") {
      v(el);
    } else if (k === "text") {
      el.textContent = String(v);
    } else if (k.length > 2 && k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (!svg && k === "value") {
      el.value = String(v);
    } else if (!svg && BOOL.has(k)) {
      el[k] = true;
      if (k === "hidden" || k === "disabled" || k === "checked") el.setAttribute(k, "");
    } else {
      el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  append(el, kids);
  return el;
}

export function append(parent, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue;
    if (Array.isArray(k)) append(parent, k);
    else parent.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return parent;
}

export function frag(...kids) {
  return append(document.createDocumentFragment(), kids);
}

/** Replace the children of `target`. */
export function mount(target, ...kids) {
  target.replaceChildren();
  append(target, kids);
  return target;
}

/** Scoped cleanup bag: listeners, timers and arbitrary disposers, with an AbortSignal for requests. */
export function createScope() {
  const ac = new AbortController();
  const offs = [];
  const scope = {
    signal: ac.signal,
    add(fn) {
      if (typeof fn === "function") offs.push(fn);
      return fn;
    },
    on(target, ev, fn, opts) {
      target.addEventListener(ev, fn, opts);
      offs.push(() => target.removeEventListener(ev, fn, opts));
    },
    interval(fn, ms) {
      const id = setInterval(fn, ms);
      offs.push(() => clearInterval(id));
    },
    timeout(fn, ms) {
      const id = setTimeout(fn, ms);
      offs.push(() => clearTimeout(id));
    },
    dispose() {
      ac.abort();
      while (offs.length) {
        try { offs.pop()(); } catch { /* ignore */ }
      }
    },
  };
  return scope;
}

export const isAbort = (e) => e?.name === "AbortError";

/** Coalesce many calls into one per animation frame. */
export function rafBatch(fn) {
  let queued = false;
  let last;
  return (...args) => {
    last = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...last);
    });
  };
}

export function debounce(fn, ms = 250) {
  let t;
  const d = (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  d.cancel = () => clearTimeout(t);
  return d;
}

let uidN = 0;
export const uid = (p = "r") => `${p}${++uidN}`;
