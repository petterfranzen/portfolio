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
 * Public, unauthenticated reads:
 *   1. repos/<repo>/contents/nights — which night folders actually exist, the
 *      repo being the source of truth for that;
 *   2. nights/<folder>/night.json — one file per night (date, language, idea,
 *      verdict), where the repo has kept its night log since 14 Nov 2026;
 *   3. LOG.md — the older table, used only for a night with no night.json.
 *
 * Each night also gets a `standing` derived from its verdict (liked, reviewed
 * or pending), so the page can feature the nights that were liked without
 * anyone picking them by hand.
 *
 * It fails soft on purpose: with no network, or when the API refuses, the
 * previously generated file is kept so the build still ships a site — a stale
 * list beats a broken one. Set GITHUB_TOKEN to lift the anonymous rate limit.
 *
 * Pass --check to verify instead of build: it rebuilds the list and fails
 * (exit 1) if the committed file has drifted from ghost-in-the-machine, or if
 * the repo can't be reached — CI runs it so the list can't go stale quietly.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "petterfranzen/ghost-in-the-machine";
const BRANCH = "main";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
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

/** One table line as trimmed cells, without the outer pipes. */
function cellsOf(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** The old LOG.md table, keyed by night folder. Empty if it can't be read. */
async function logRows() {
  const rows = new Map();
  let text;
  try {
    text = await get(`${RAW_BASE}/LOG.md`, "text");
  } catch {
    return rows;
  }
  for (const line of text.split("\n")) {
    const [date, folder, language, idea, verdict = ""] = cellsOf(line);
    if (!idea || !FOLDER_RE.test(folder)) continue;
    rows.set(folder, { date, language, idea, verdict });
  }
  return rows;
}

const text = (value) => (typeof value === "string" ? value.trim() : "");

/** A night's own night.json, or null when the folder has none. */
async function nightFile(slug) {
  let raw;
  try {
    raw = JSON.parse(await get(`${RAW_BASE}/nights/${slug}/night.json`, "text"));
  } catch (error) {
    if (String(error?.message).startsWith("404")) return null;
    throw error;
  }
  const row = {
    date: text(raw.date) || slug.slice(0, 10),
    language: text(raw.language),
    idea: text(raw.idea),
    verdict: text(raw.verdict),
  };
  return row.language && row.idea ? row : null;
}

/** liked, reviewed or pending — read off the verdict, never typed in here. */
function standingOf(verdict) {
  if (/\b(liked|loved|great)\b/i.test(verdict)) return "liked";
  if (!verdict || /\bpending\b/i.test(verdict)) return "pending";
  return "reviewed";
}

const byNewest = (a, b) =>
  a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date);

/** Every night that has a row, from night.json first and LOG.md otherwise. */
async function readNights() {
  const [folders, log] = await Promise.all([nightFolders(), logRows()]);
  const rows = await Promise.all(
    folders.map(async (slug) => ({ slug, row: (await nightFile(slug)) ?? log.get(slug) })),
  );
  const nights = rows
    .filter(({ row }) => row)
    .map(({ slug, row }) => ({
      date: row.date,
      slug,
      title: titleFromSlug(slug),
      language: row.language,
      idea: row.idea,
      verdict: row.verdict,
      standing: standingOf(row.verdict),
      url: `${PAGES_BASE}/${slug}/`,
    }))
    .sort(byNewest);
  if (nights.length === 0) {
    throw new Error("no night folders with a night.json or a LOG.md entry were found");
  }
  return nights;
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

/** --check: verify the committed list instead of writing it. */
const CHECK = process.argv.includes("--check");

const warn = (message) => console.warn(`build-experiments: ${message}`);
const fail = (message) => {
  console.error(`build-experiments: ${message}`);
  process.exitCode = 1;
};

/**
 * The nights to publish, or null when there is nothing new to write: the
 * check cannot vouch for a list it could not rebuild, and a build keeps the
 * committed copy rather than ship an empty one.
 */
async function nightsOrFallback() {
  try {
    return await readNights();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (CHECK) {
      fail(`cannot reach ghost-in-the-machine: ${reason}`);
      fail("cannot verify the committed list");
      return null;
    }
    warn(reason);
    if (existsSync(OUT)) {
      warn("keeping the committed list");
      return null;
    }
    warn("writing an empty list");
    return [];
  }
}

async function check(rendered, count) {
  const committed = existsSync(OUT) ? await readFile(OUT, "utf8") : "";
  if (committed === rendered) {
    console.log(`build-experiments: list is up to date (${count} night(s))`);
    return;
  }
  fail(`the committed list is out of date — ghost-in-the-machine now has ${count} night(s)`);
  fail("run `npm run experiments` and commit src/experiments.generated.json");
}

async function main() {
  const nights = await nightsOrFallback();
  if (!nights) return;

  const payload = {
    generated: "scripts/build-experiments.mjs",
    index: `${PAGES_BASE}/`,
    crew: `${PAGES_BASE}/crew/`,
    experiments: nights,
  };
  const rendered = `${JSON.stringify(payload, null, 2)}\n`;

  if (CHECK) {
    await check(rendered, nights.length);
    return;
  }
  await writeFile(OUT, rendered);
  console.log(
    `build-experiments: ${nights.length} night(s) -> ${path.relative(process.cwd(), OUT)}`,
  );
}

main().catch((error) => {
  console.error(`build-experiments: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
