#!/usr/bin/env node
/**
 * Guards the security headers the portfolio serves. Fast: no build, no browser.
 *
 * Static (always): nginx.conf and security-headers.conf must declare the
 * headers; the snippet must be included in the server block and in every
 * location block that sets its own add_header (nginx stops inheriting the
 * moment a block declares one); HSTS must not be set here; and every script
 * in every page must be allowed by script-src: each inline one by its sha256,
 * each external one by being same-origin. The pages are the source HTML and,
 * once `npm run build` has run, every HTML file in dist/ (CI runs it after the
 * build, so what ships is what is checked).
 *
 * Live (optional): set TARGET_URL to fetch a running site and assert the
 * headers actually arrive.
 *
 *   npm run test:headers
 *   TARGET_URL=https://www.pastabake.cloud npm run test:headers
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNIPPET = "/etc/nginx/security-headers.conf";
const REQUIRED = [
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Content-Security-Policy",
];

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

/** Every block in an nginx config, with the headers and includes it declares. */
function blocks(text) {
  const stack = [];
  const done = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^(server|location)\b[^{]*\{/.test(line)) {
      stack.push({ kind: line.startsWith("server") ? "server" : "location", line, headers: [], includes: [] });
      continue;
    }
    if (line === "}" || line === "};") {
      if (stack.length) done.push(stack.pop());
      continue;
    }
    if (!stack.length || line.startsWith("#")) continue;
    const current = stack[stack.length - 1];
    const header = line.match(/^add_header\s+([A-Za-z0-9-]+)\s/);
    if (header) current.headers.push(header[1]);
    const include = line.match(/^include\s+([^;]+);/);
    if (include) current.includes.push(include[1].trim());
  }
  return done;
}

/** The text between <script> and </script> for every inline script. */
function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

const nginx = readFileSync(join(root, "nginx.conf"), "utf8");
const headersConf = readFileSync(join(root, "security-headers.conf"), "utf8");

/** Every .html file under dir, as paths. */
function htmlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".html"))
    .map((file) => join(dir, file));
}

/** The source pages plus whatever the last build wrote to dist/. */
const pages = [
  join(root, "index.html"),
  join(root, "how-this-was-built", "index.html"),
  ...htmlFiles(join(root, "dist")),
].map((file) => ({ name: relative(root, file), html: readFileSync(file, "utf8") }));

/** The src of every external script. */
function externalScripts(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
}

const sha256 = (text) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

const declared = new Set(
  [...headersConf.matchAll(/^add_header\s+([A-Za-z0-9-]+)\s/gm)].map((m) => m[1]),
);

for (const name of REQUIRED) {
  await check(`security-headers.conf declares ${name}`, () => {
    assert.ok(declared.has(name), `${name} is not declared in security-headers.conf`);
  });
}

await check("HSTS is not set here (it is a Cloudflare toggle)", () => {
  assert.ok(!declared.has("Strict-Transport-Security"), "Strict-Transport-Security belongs to the edge");
});

const parsed = blocks(nginx);

await check("the server block includes the security headers", () => {
  const server = parsed.find((b) => b.kind === "server");
  assert.ok(server, "no server block in nginx.conf");
  assert.ok(server.includes.includes(SNIPPET), `the server block does not include ${SNIPPET}`);
});

await check("every block that sets a header re-includes the snippet", () => {
  const ownHeaders = parsed.filter((b) => b.kind === "location" && b.headers.length);
  assert.ok(ownHeaders.length > 0, "expected at least one location setting Cache-Control");
  for (const block of ownHeaders) {
    assert.ok(
      block.includes.includes(SNIPPET),
      `"${block.line}" sets ${block.headers.join(", ")} and would drop the inherited security headers`,
    );
  }
});

const scriptSrc = headersConf.match(/Content-Security-Policy\s+"([^"]+)"/)?.[1].match(/script-src([^;]*)/)?.[1] ?? "";

await check("script-src allows no inline script by default", () => {
  assert.ok(scriptSrc, "no CSP with a script-src found");
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), "script-src must not allow 'unsafe-inline'");
  assert.match(scriptSrc, /'self'/, "script-src must allow 'self' for the bundles and /boot.js");
});

await check(`every script in ${pages.length} page(s) is allowed by script-src`, () => {
  assert.ok(pages.length >= 2, "expected at least index.html and how-this-was-built/index.html");
  for (const page of pages) {
    for (const script of inlineScripts(page.html)) {
      const hash = sha256(script);
      assert.ok(scriptSrc.includes(hash), `${page.name}: an inline script (${hash}) is blocked by script-src`);
    }
    for (const src of externalScripts(page.html)) {
      assert.ok(src.startsWith("/") && !src.startsWith("//"), `${page.name}: ${src} is not same-origin`);
    }
  }
});

const target = process.env.TARGET_URL;
if (target) {
  const response = await fetch(new URL("/", target), { redirect: "follow" });
  const served = (name) => response.headers.get(name.toLowerCase()) ?? "";
  for (const name of REQUIRED) {
    await check(`the deployed site sends ${name}`, () => {
      assert.ok(served(name), `${target} does not send ${name}`);
    });
  }
  await check("the deployed nosniff value matches", () => {
    assert.equal(served("X-Content-Type-Options"), "nosniff");
  });
  await check("no inline script is blocked by the served CSP", async () => {
    const csp = served("Content-Security-Policy");
    for (const script of inlineScripts(await response.clone().text())) {
      const hash = sha256(script);
      assert.ok(csp.includes(hash), `the served CSP does not allow ${hash}`);
    }
  });
} else {
  console.log("  --   live checks skipped (set TARGET_URL to run them)");
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nall checks passed");
}
