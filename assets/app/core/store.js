/* Observable state: just enough for auth/prefs/telemetry. */

export function createStore(initial = {}) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      let changed = false;
      for (const k of Object.keys(next || {})) if (!Object.is(state[k], next[k])) changed = true;
      if (!changed) return state;
      state = { ...state, ...next };
      for (const fn of [...subs]) {
        try { fn(state); } catch (e) { console.error("subscriber failed", e); }
      }
      return state;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
