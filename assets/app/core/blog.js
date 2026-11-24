// Helpers for the "new blog post" notice (pure; unit-tested).
import { getApiBase } from "./api.js";

const SEEN_KEY = "rift_staff_blog_seen";
const SEEN_LIMIT = 30;
const FRESH_SECONDS = 7 * 86400;
export const BLOG_SITE = "https://rift.cool";

export function readSeen() {
  try { const p = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); return Array.isArray(p) ? p : []; } catch { return []; }
}
export function markSeen(id) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([id, ...readSeen().filter((x) => x !== id)].slice(0, SEEN_LIMIT))); } catch { /* may show again; harmless */ }
}
export const isUsable = (p) => Boolean(p && p.id && p.slug && p.title);
export const postUrl = (p) => `${BLOG_SITE}/blog/${encodeURIComponent(p.slug)}`;
export const bannerUrl = (apiBase, id) => `${String(apiBase).replace(/\/+$/, "")}/api/blog/images/${encodeURIComponent(id)}`;
export const isFresh = (p, now = Date.now() / 1000) => now - (p.published_at || p.created_at || 0) <= FRESH_SECONDS;

/** Newest published post if recent, else null. Never throws. */
export async function fetchLatestPost(apiBase = getApiBase(), { fetchImpl = (...a) => fetch(...a), now } = {}) {
  try {
    const res = await fetchImpl(`${String(apiBase).replace(/\/+$/, "")}/api/blog/posts?limit=1`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const post = (await res.json()).posts?.[0];
    return isUsable(post) && post.status === "published" && isFresh(post, now) ? post : null;
  } catch { return null; }
}
