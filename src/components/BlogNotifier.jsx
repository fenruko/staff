import React, { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, connectExecSocket } from "../lib/api";
import { bannerUrl, fetchLatestPost, isUsable, markSeen, postUrl, readSeen } from "../lib/blogNotice";
import Icon from "./Icon";

const AUTO_CLOSE_MS = 16000;
const MAX_VISIBLE = 3;

/* Small "New on the Rift blog" cards. A post arrives over the staff socket the
   moment it's published; on load the newest post is also fetched once, so
   staff who weren't online at publish time still see it. Each post shows once. */
export default function BlogNotifier() {
  const [notices, setNotices] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setNotices((list) => list.filter((n) => n.id !== id));
  }, []);

  const arm = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => dismiss(id), AUTO_CLOSE_MS));
  }, [dismiss]);

  const show = useCallback((post) => {
    if (!isUsable(post) || readSeen().includes(post.id)) return;
    markSeen(post.id);
    setNotices((list) => [...list.filter((n) => n.id !== post.id), post].slice(-MAX_VISIBLE));
    arm(post.id);
  }, [arm]);

  useEffect(() => {
    let cancelled = false;
    fetchLatestPost(API_BASE).then((post) => { if (post && !cancelled) show(post); });
    const disconnect = connectExecSocket((msg) => {
      if (msg.type === "blog_post") show(msg.data);
    });
    const pending = timers.current;
    return () => {
      cancelled = true;
      disconnect();
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [show]);

  if (!notices.length) return null;
  return (
    <div className="fixed left-4 bottom-4 z-[60] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]" role="region" aria-label="Blog updates" aria-live="polite">
      {notices.map((post) => (
        <div
          key={post.id}
          role="status"
          className="relative flex items-start gap-3 rounded-xl border border-border bg-panel p-3 pr-9 shadow-xl"
          onMouseEnter={() => clearTimeout(timers.current.get(post.id))}
          onMouseLeave={() => arm(post.id)}
        >
          {post.banner_id ? (
            <img src={bannerUrl(API_BASE, post.banner_id)} alt="" width="64" height="64" loading="lazy" className="h-16 w-16 flex-none rounded-lg object-cover bg-white/5" />
          ) : (
            <div className="h-16 w-16 flex-none rounded-lg bg-white/5 grid place-items-center text-white/40" aria-hidden="true"><Icon name="message" size={22} /></div>
          )}
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">New on the Rift blog</span>
            <strong className="text-sm text-white/90 leading-snug">{post.title}</strong>
            {post.excerpt && <span className="text-xs text-white/50 line-clamp-2">{post.excerpt}</span>}
            <a href={postUrl(post)} target="_blank" rel="noopener noreferrer" onClick={() => dismiss(post.id)} className="mt-1 w-fit text-xs font-semibold text-blue-400 hover:underline">Read the post</a>
          </div>
          <button type="button" onClick={() => dismiss(post.id)} aria-label="Dismiss" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-white/40 hover:bg-white/10 hover:text-white">
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
