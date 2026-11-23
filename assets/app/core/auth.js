import { api, getToken, setToken } from "./api.js";
import { createStore } from "./store.js";

export const hasPermission = (user, perm) => {
  if (!user) return false;
  const perms = user.permissions || [];
  if (perms.includes("*")) return true;
  return Array.isArray(perm) ? perm.some((p) => perms.includes(p)) : perms.includes(perm);
};

const toUser = (me) => ({ id: me.id, username: me.username, role: me.role, permissions: me.permissions || [] });

/** status: loading | anon | authed | offline (token kept, backend unreachable) */
export const auth = createStore({ status: "loading", user: null });
let retryTimer = null;

export const can = (perm) => hasPermission(auth.get().user, perm);

export async function restore() {
  clearTimeout(retryTimer);
  if (!getToken()) return auth.set({ status: "anon", user: null });
  try {
    auth.set({ status: "authed", user: toUser(await api.me()) });
  } catch (e) {
    if (e?.network) {
      // Keep the stored token and quietly retry so the session restores itself.
      auth.set({ status: "offline", user: null });
      retryTimer = setTimeout(restore, 10000);
    } else {
      auth.set({ status: "anon", user: null });
    }
  }
}

export async function login(username, password, totp) {
  const res = await api.login(username, password, totp);
  setToken(res.token);
  auth.set({ status: "authed", user: toUser(res) });
  return res;
}

export async function logout() {
  try { await api.logout(); } catch { /* sign out locally regardless */ }
  setToken(null);
  auth.set({ status: "anon", user: null });
}

export const lostSession = () => auth.set({ status: "anon", user: null });
