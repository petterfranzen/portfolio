#!/usr/bin/env node
/**
 * Generates src/experiments.generated.json — the nightly apps shown in act 4
 * of the site.
 *
 * That list lives in ghost-in-the-machine, where a new one lands every night,
 * so it is read here at build time and baked into the HTML and the bundle. The
 * browser never calls GitHub: by the time the site is served, the list is
 * already there.
 *
 * Two public, unauthenticated reads:
 *   1. repos/<repo>/contents/nights — which night folders actually exist, the
 *      repo being the source of truth for that;
 *   2. LOG.md — the idea and language for each night, the repo's own index.
 *
 * It fails soft on purpose: with no network, or when the API refuses, the
 * previously generated file is kept so the build still ships a site — a stale
 * list beats a broken one. Set GITHUB_TOKEN to lift the anonymous rate limit.
 */

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "petterfranzen/ghost-in-the-machine";
const BRANCH = "main";
const PAGES_BASE = "https://petterfranzen.github.io/ghost-in-the-machine";
const OUT = path.resolve(
  fileURLToPath(new URL("../src/experiments.generated.json", import.meta.url)),
);
const TIMEOUT_MS = 10_000;
const FOLDER_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
const SMALL_WORDS = new Set(["and", "of", "the", "in", "on", "a", "to"]);

async function get(url, as = "json") {
  const headers = {
    "User-Agent": "portfolio-build-experiments",
    Accept: as === "json" ? "application/vnd.github+json" : "text/plain",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} — ${url}`);
  }
  return as === "json" ? response.json() : response.text();
}

/** Just the night folders; README.md and anything else in nights/ is ignored. */
async function nightFolders() {
  const entries = await get(
    `https://api.github.com/repos/${REPO}/contents/nights`,
  );
  return entries
    .filter((entry) => entry.type === "dir" && FOLDER_RE.test(entry.name))
    .map((entry) => entry.name);
}

/** The LOG.md table, keyed by night folder: date, language and idea. */
async function logRows() {
  const text = await get(
    `https://raw.githubusercontent.com/${REPO}/${BRANCH}/LOG.md`,
    "text",
  );
  const rows = new Map();
  for (const line of text.split("\n")) {
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 5) continue;
    const [date, folder, language, idea] = cells;
    if (!FOLDER_RE.test(folder)) continue;
    rows.set(folder, { date, language, idea });
  }
  return rows;
}

/** "2026-10-31-koi-drift" -> "Koi Drift". */
function titleFromSlug(slug) {
  const words = slug.replace(/^\d{4}-\d{2}-\d{2}-/, "").split("-");
  return words
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

async function main() {
  let nights;
  try {
    const [folders, log] = await Promise.all([nightFolders(), logRows()]);
    nights = folders
      .filter((slug) => log.has(slug))
      .map((slug) => {
        const row = log.get(slug);
        return {
          date: row.date,
          slug,
          title: titleFromSlug(slug),
          language: row.language,
          idea: row.idea,
          url: `${PAGES_BASE}/${slug}/`,
        };
      })
      .sort((a, b) =>
        a.date === b.date
          ? a.slug.localeCompare(b.slug)
          : b.date.localeCompare(a.date),
      );
    if (nights.length === 0) {
      throw new Error("no night folders with a LOG.md entry were found");
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (existsSync(OUT)) {
      console.warn(`build-experiments: ${reason}`);
      console.warn("build-experiments: keeping the committed list");
      return;
    }
    console.warn(`build-experiments: ${reason}`);
    console.warn("build-experiments: writing an empty list");
    nights = [];
  }

  const payload = {
    generated: "scripts/build-experiments.mjs",
    index: `${PAGES_BASE}/`,
    crew: `${PAGES_BASE}/crew/`,
    experiments: nights,
  };
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `build-experiments: ${nights.length} night(s) -> ${path.relative(process.cwd(), OUT)}`,
  );
}

main().catch((error) => {
  console.error(`build-experiments: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
