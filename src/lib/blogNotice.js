// Helpers for the "new blog post" popup. Kept free of React so they're easy to test.

const SEEN_KEY = "rift_staff_blog_seen";
const SEEN_LIMIT = 30;
const FRESH_SECONDS = 7 * 86400;
export const BLOG_SITE = "https://rift.cool";

export function readSeen() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markSeen(id) {
  try {
    const next = [id, ...readSeen().filter((x) => x !== id)].slice(0, SEEN_LIMIT);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: it may show again next visit, which is harmless.
  }
}

export const isUsable = (post) => Boolean(post && post.id && post.slug && post.title);
export const postUrl = (post) => `${BLOG_SITE}/blog/${encodeURIComponent(post.slug)}`;
export const bannerUrl = (apiBase, bannerId) => `${String(apiBase).replace(/\/+$/, "")}/api/blog/images/${encodeURIComponent(bannerId)}`;

export function isFresh(post, nowSeconds = Date.now() / 1000) {
  return nowSeconds - (post.published_at || post.created_at || 0) <= FRESH_SECONDS;
}

/** Newest published post if it is recent, else null. Never throws. */
export async function fetchLatestPost(apiBase, { fetchImpl = (...a) => fetch(...a), now } = {}) {
  try {
    const res = await fetchImpl(`${String(apiBase).replace(/\/+$/, "")}/api/blog/posts?limit=1`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const post = (await res.json()).posts?.[0];
    return isUsable(post) && post.status === "published" && isFresh(post, now) ? post : null;
  } catch {
    return null;
  }
}
