import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

let socketHandler = null;
vi.mock("../src/lib/api", () => ({
  API_BASE: "https://api.test",
  connectExecSocket: (onMessage) => {
    socketHandler = onMessage;
    return () => { socketHandler = null; };
  },
}));

import BlogNotifier from "../src/components/BlogNotifier";
import { fetchLatestPost } from "../src/lib/blogNotice";

const post = (over = {}) => ({ id: 7, slug: "hello-world", title: "Hello world", excerpt: "A short summary.", banner_id: 3, status: "published", published_at: Math.floor(Date.now() / 1000) - 60, ...over });

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  socketHandler = null;
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ posts: [] }) }));
});

describe("BlogNotifier", () => {
  it("shows a pushed post with title, summary, thumbnail and link", async () => {
    render(<BlogNotifier />);
    await waitFor(() => expect(socketHandler).toBeTruthy());
    act(() => socketHandler({ type: "blog_post", data: post() }));
    expect(screen.getByText("Hello world")).toBeTruthy();
    expect(screen.getByText("A short summary.")).toBeTruthy();
    expect(document.querySelector("img").getAttribute("src")).toBe("https://api.test/api/blog/images/3");
    expect(screen.getByText("Read the post").getAttribute("href")).toBe("https://rift.cool/blog/hello-world");
  });

  it("ignores other message types and shows each post only once", async () => {
    render(<BlogNotifier />);
    await waitFor(() => expect(socketHandler).toBeTruthy());
    act(() => socketHandler({ type: "appeal_submitted", id: 1 }));
    expect(screen.queryByRole("status")).toBeNull();
    act(() => socketHandler({ type: "blog_post", data: post() }));
    fireEvent.click(screen.getByLabelText("Dismiss"));
    act(() => socketHandler({ type: "blog_post", data: post() }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders titles as text, not markup", async () => {
    render(<BlogNotifier />);
    await waitFor(() => expect(socketHandler).toBeTruthy());
    act(() => socketHandler({ type: "blog_post", data: post({ title: "<b>bold</b>" }) }));
    expect(screen.getByText("<b>bold</b>")).toBeTruthy();
    expect(document.querySelector("strong b")).toBeNull();
  });

  it("catches up on a fresh post when opened", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ posts: [post()] }) }));
    render(<BlogNotifier />);
    expect(await screen.findByText("Hello world")).toBeTruthy();
  });
});

describe("fetchLatestPost", () => {
  const reply = (posts, ok = true) => async () => ({ ok, json: async () => ({ posts }) });
  it("only returns a recent published post", async () => {
    expect(await fetchLatestPost("https://api.test", { fetchImpl: reply([post()]) })).toBeTruthy();
    expect(await fetchLatestPost("https://api.test", { fetchImpl: reply([post({ published_at: 1 })]) })).toBeNull();
    expect(await fetchLatestPost("https://api.test", { fetchImpl: reply([post({ status: "draft" })]) })).toBeNull();
    expect(await fetchLatestPost("https://api.test", { fetchImpl: reply([], false) })).toBeNull();
    expect(await fetchLatestPost("https://api.test", { fetchImpl: async () => { throw new Error("offline"); } })).toBeNull();
  });
});
