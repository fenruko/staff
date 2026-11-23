import { createStore } from "./store.js";

const KEY = "rift_staff_prefs";
const DEFAULTS = { theme: "dark", density: "comfortable" };

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch { return {}; }
}

export const prefs = createStore({ ...DEFAULTS, ...read() });

export function applyPrefs(p = prefs.get()) {
  const root = document.documentElement;
  root.dataset.theme = p.theme === "light" ? "light" : "dark";
  root.dataset.density = p.density === "compact" ? "compact" : "comfortable";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", p.theme === "light" ? "#f6f8fb" : "#08090c");
}

export function setPref(patch) {
  prefs.set(patch);
  applyPrefs();
  try { localStorage.setItem(KEY, JSON.stringify(prefs.get())); } catch { /* private mode */ }
}
