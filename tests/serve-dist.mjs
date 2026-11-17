#!/usr/bin/env node
/**
 * Serves dist/ the way the nginx image does, for the browser tests in CI:
 * every response carries the headers security-headers.conf declares (the CSP
 * included), and unknown paths fall back to the page that owns them, like
 * nginx.conf's try_files. That way the smoke suite runs under the real CSP,
 * and a script the CSP would block shows up as a console error there.
 *
 *   npm run build && node tests/serve-dist.mjs   # http://127.0.0.1:4173
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(root, "dist");
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

/** name -> value for every add_header in the snippet nginx includes. */
const HEADERS = Object.fromEntries(
  [...readFileSync(join(root, "security-headers.conf"), "utf8").matchAll(/^add_header\s+(\S+)\s+"([^"]*)"/gm)].map(
    (m) => [m[1], m[2]],
  ),
);

const isFile = (file) => existsSync(file) && statSync(file).isFile();

/** The file nginx would answer with: the path, its index.html, or the owning page. */
function resolve(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const direct = join(DIST, safe);
  if (isFile(direct)) return direct;
  if (isFile(join(direct, "index.html"))) return join(direct, "index.html");
  const page = safe.startsWith("/how-this-was-built/") ? "how-this-was-built/index.html" : "index.html";
  return join(DIST, page);
}

createServer((request, response) => {
  const file = resolve(new URL(request.url ?? "/", "http://localhost").pathname);
  response.writeHead(200, { ...HEADERS, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  response.end(readFileSync(file));
}).listen(PORT, "127.0.0.1", () => console.log(`serve-dist: http://127.0.0.1:${PORT} (${Object.keys(HEADERS).length} headers)`));
