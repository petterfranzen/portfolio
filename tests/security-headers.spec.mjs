#!/usr/bin/env node
/**
 * Guards the security headers the portfolio serves. Fast: no build, no browser.
 *
 * Static (always): nginx.conf and security-headers.conf must declare the
 * headers; the snippet must be included in the server block and in every
 * location block that sets its own add_header (nginx stops inheriting the
 * moment a block declares one); HSTS must not be set here; and the pinned
 * sha256 in the CSP must still match the inline boot script in index.html.
 *
 * Live (optional): set TARGET_URL to fetch a running site and assert the
 * headers actually arrive.
 *
 *   npm run test:headers
 *   TARGET_URL=https://www.pastabake.cloud npm run test:headers
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
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
const html = readFileSync(join(root, "index.html"), "utf8");

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

await check("the CSP pins the inline boot script", () => {
  const csp = headersConf.match(/Content-Security-Policy\s+"([^"]+)"/)?.[1];
  assert.ok(csp, "no CSP found");
  const scriptSrc = csp.match(/script-src([^;]*)/)?.[1] ?? "";
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), "script-src must not allow 'unsafe-inline'");
  const inline = inlineScripts(html);
  assert.equal(inline.length, 1, `expected exactly one inline script, found ${inline.length}`);
  const hash = `'sha256-${createHash("sha256").update(inline[0], "utf8").digest("base64")}'`;
  assert.ok(
    scriptSrc.includes(hash),
    `script-src is missing ${hash} - the inline boot script changed, update security-headers.conf`,
  );
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
      const hash = `'sha256-${createHash("sha256").update(script, "utf8").digest("base64")}'`;
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
