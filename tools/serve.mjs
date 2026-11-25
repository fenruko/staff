/* Tiny static server with SPA fallback for local development. No dependencies. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
const ROOT = resolve(import.meta.dirname, "..");
const PORT = Number(process.env.PORT || 4174);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".txt": "text/plain" };
export function createStaticServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); } catch { /* fall through */ }
    let body;
    try { body = await readFile(file); } catch {
      if (extname(url.pathname)) { res.writeHead(404).end("Not found"); return; }
      body = await readFile(join(ROOT, "index.html")); file = "index.html"; // SPA deep link
    }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  });
}
if (import.meta.url === `file://${process.argv[1]}`) createStaticServer().listen(PORT, "0.0.0.0", () => console.log(`Rift Staff → http://localhost:${PORT}/  (add ?demo=1 for the in-browser mock backend)`));
