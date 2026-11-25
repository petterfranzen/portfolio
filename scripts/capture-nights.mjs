#!/usr/bin/env node
/**
 * Captures a screenshot of every night that does not have one yet, so nobody
 * has to add one by hand.
 *
 * The night list comes from ghost-in-the-machine's Pages index — the same list
 * a visitor sees — so a night is captured the first build after it goes live.
 * Each night's page is loaded in Chromium at 1280x800, given time to draw, and
 * captured; the 1280x800 frame is then scaled down to the 640x400 WebP the
 * tiles ask for and written to public/nights/<folder>.webp.
 *
 * A night that already has a file is left alone: the hand-made shots from
 * before this script existed stay as they are. A night whose capture fails is
 * logged and skipped — the tile falls back to its plain panel, and the build
 * carries on. Run with --strict to fail instead.
 *
 *   npm run capture             # capture what is missing
 *   npm run capture -- --check  # list what is missing, exit 1 if anything is
 *   npm run capture -- --force  # re-capture every night, hand-made ones too
 *
 * It is safe to run with no browser or no network: it says so and exits 0, so
 * a local build and a CI build that cannot reach Pages still ship a site.
 * CAPTURE_NIGHTS=0 turns it off, CHROMIUM_PATH points at a system Chromium
 * when Playwright's own download is not installed, and CAPTURE_NIGHTS_BASE
 * overrides the Pages base URL.
 */

import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PAGES_BASE = (
  process.env.CAPTURE_NIGHTS_BASE ??
  "https://petterfranzen.github.io/ghost-in-the-machine"
).replace(/\/$/, "");

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_DIR = path.join(ROOT, "public");
const THUMBNAIL_DIR = "nights";

/** The tile asks for 640x400; capture at 1280x800 and scale down. */
const SHOT_WIDTH = 1280;
const SHOT_HEIGHT = 800;
const THUMB_WIDTH = 640;
const THUMB_HEIGHT = 400;
const WEBP_QUALITY = 0.82;

/** A page that drew something is bigger than this; a blank one is not. */
const MIN_BYTES = 1200;

const NAV_TIMEOUT_MS = 45_000;
const DRAW_TIMEOUT_MS = 20_000;
const SETTLE_MS = 900;

const FOLDER_RE = /^(\d{4}-\d{2}-\d{2}-[a-z0-9-]+)$/;

const CHECK = process.argv.includes("--check");
const FORCE = process.argv.includes("--force");
const STRICT = process.argv.includes("--strict");

const log = (message) => console.log(`capture-nights: ${message}`);
const warn = (message) => console.warn(`capture-nights: ${message}`);

/** Every night folder the Pages index links to, in the order it lists them. */
async function nightsOnPages() {
  const response = await fetch(`${PAGES_BASE}/`, {
    headers: { "User-Agent": "portfolio-capture-nights" },
    signal: AbortSignal.timeout(NAV_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} — ${PAGES_BASE}/`);
  }
  const html = await response.text();
  const folders = new Set();
  for (const match of html.matchAll(/href="([^"]*\/)"/g)) {
    const name = match[1].replace(/\/$/, "").split("/").pop() ?? "";
    if (FOLDER_RE.test(name)) folders.add(name);
  }
  return [...folders];
}

const thumbnailPath = (slug) => path.join(PUBLIC_DIR, THUMBNAIL_DIR, `${slug}.webp`);

const hasThumbnail = (slug) => existsSync(thumbnailPath(slug));

/** Launch Chromium, or explain why we cannot and return null. */
async function launch() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    warn("playwright is not installed; skipping the capture");
    return null;
  }
  try {
    return await chromium.launch({
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
    });
  } catch (error) {
    const reason = String(error?.message ?? error).split("\n")[0];
    warn(`no Chromium to capture with (${reason}); skipping the capture`);
    return null;
  }
}

/**
 * Wait until the page has something to show: a canvas or a paragraph, the
 * network quiet, and two animation frames flushed. Night apps draw in a rAF
 * loop, so this is "drawn" as far as a screenshot can tell; the settle delay
 * covers the first scene's own fade-in.
 */
async function waitForDraw(page) {
  await page
    .waitForFunction(
      () => {
        const canvas = document.querySelector("canvas");
        const text = (document.body?.innerText ?? "").trim();
        const drawn = canvas && canvas.width > 0 && canvas.height > 0;
        return Boolean(drawn) || text.length > 20;
      },
      undefined,
      { timeout: DRAW_TIMEOUT_MS },
    )
    .catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: DRAW_TIMEOUT_MS }).catch(() => {});
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await page.waitForTimeout(SETTLE_MS);
}

/** Scale the captured frame down to 640x400 and encode it as WebP. */
async function toWebp(browser, png) {
  const page = await browser.newPage({ viewport: { width: THUMB_WIDTH, height: THUMB_HEIGHT } });
  try {
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const encoded = await page.evaluate(
      async ({ dataUrl, width, height, quality }) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, width, height);
        return canvas.toDataURL("image/webp", quality);
      },
      { dataUrl, width: THUMB_WIDTH, height: THUMB_HEIGHT, quality: WEBP_QUALITY },
    );
    return Buffer.from(encoded.replace(/^data:image\/webp;base64,/, ""), "base64");
  } finally {
    await page.close();
  }
}

/** Capture one night. Returns the bytes, or throws with a short reason. */
async function capture(browser, slug) {
  const context = await browser.newContext({
    viewport: { width: SHOT_WIDTH, height: SHOT_HEIGHT },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.message ?? error).split("\n")[0]));
  try {
    const response = await page.goto(`${PAGES_BASE}/${slug}/`, {
      waitUntil: "load",
      timeout: NAV_TIMEOUT_MS,
    });
    if (response && !response.ok()) throw new Error(`HTTP ${response.status()}`);
    await waitForDraw(page);
    const png = await page.screenshot({ type: "png", fullPage: false, scale: "device" });
    const webp = await toWebp(browser, png);
    if (webp.length < MIN_BYTES) throw new Error(`the frame looks blank (${webp.length} bytes)`);
    if (errors.length) warn(`${slug}: page errors ignored — ${errors[0]}`);
    return webp;
  } finally {
    await context.close();
  }
}

/** Write to a temp name and rename, so a half-written file never ships. */
async function save(slug, webp) {
  const target = thumbnailPath(slug);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp`;
  await writeFile(temp, webp);
  await rename(temp, target);
}

async function main() {
  if (process.env.CAPTURE_NIGHTS === "0") {
    log("CAPTURE_NIGHTS=0, skipping");
    return;
  }

  let nights;
  try {
    nights = await nightsOnPages();
  } catch (error) {
    warn(`cannot read the night list (${String(error?.message ?? error)}); skipping the capture`);
    return;
  }
  if (nights.length === 0) {
    warn("the Pages index lists no nights; skipping the capture");
    return;
  }

  const missing = nights.filter((slug) => FORCE || !hasThumbnail(slug));
  if (missing.length === 0) {
    log(`every night has a screenshot (${nights.length} night(s))`);
    return;
  }
  if (CHECK) {
    console.error(`capture-nights: ${missing.length} night(s) without a screenshot: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const browser = await launch();
  if (!browser) return;

  let captured = 0;
  const failed = [];
  try {
    for (const slug of missing) {
      try {
        const webp = await capture(browser, slug);
        await save(slug, webp);
        captured += 1;
        log(`${slug} -> ${THUMBNAIL_DIR}/${slug}.webp (${webp.length} bytes)`);
      } catch (error) {
        failed.push(slug);
        const reason = String(error?.message ?? error).split("\n")[0];
        warn(`${slug}: capture failed (${reason}); the tile keeps its placeholder`);
      }
    }
  } finally {
    await browser.close();
  }

  const kept = nights.length - missing.length;
  log(`${captured} captured, ${failed.length} failed, ${kept} already had a screenshot`);
  if (failed.length && STRICT) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`capture-nights: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
