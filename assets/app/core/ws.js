/* One authenticated /ws/exec connection per tab, shared by every subscriber,
 * with exponential reconnect. */
import { getApiBase, getToken } from "./api.js";

const listeners = new Set();
let socket = null;
let timer = null;
let retry = 1000;
let state = "offline";

function setState(next) {
  state = next;
  listeners.forEach((l) => l.onStatus?.(next));
}

function open() {
  const token = getToken();
  if (!token || !listeners.size || socket) return;
  setState("connecting");
  const url = new URL(getApiBase(), location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/exec";
  url.search = new URLSearchParams({ token }).toString();
  let ws;
  try { ws = new WebSocket(url); } catch { setState("offline"); return; }
  socket = ws;
  ws.onopen = () => { retry = 1000; setState("connected"); };
  ws.onmessage = (evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }
    listeners.forEach((l) => {
      try { l.onMessage?.(msg); } catch (e) { console.error("socket subscriber failed", e); }
    });
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    setState("offline");
    if (listeners.size && getToken()) {
      timer = setTimeout(open, retry);
      retry = Math.min(retry * 2, 30000);
    }
  };
  ws.onerror = () => ws.close();
}

export function connectExecSocket(onMessage, onStatus) {
  const l = { onMessage, onStatus };
  listeners.add(l);
  onStatus?.(state);
  open();
  return () => {
    listeners.delete(l);
    if (!listeners.size) {
      clearTimeout(timer);
      const ws = socket;
      socket = null;
      ws?.close();
      state = "offline";
      retry = 1000;
    }
  };
}
export const socketState = () => state;
export const socketRetryDelay = () => retry;
