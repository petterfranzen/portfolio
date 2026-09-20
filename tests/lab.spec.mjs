/**
 * One journey through the Lab, against a real docker-monitor.
 *
 * Deliberately not a unit test of lab.ts: everything interesting here is
 * the seam between this page and the control API — the states the API
 * reports, whether a guest's button is enabled, and whether the demo link
 * is withheld until the stack is genuinely usable. A mocked API would
 * assert that the mock matches the code, which is what already went wrong
 * once in flight-tracker (a prod-only bug that black-box tests missed).
 *
 * Needs the stack from README's "Running the Lab locally" already up:
 *   docker run ... docker-monitor  (with a projects.json)
 *   docker run ... portfolio       (published on PORTFOLIO_URL)
 *
 * Run: node tests/lab.spec.mjs
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.PORTFOLIO_URL ?? "http://localhost:8099";
const PROJECT = process.env.LAB_PROJECT ?? "demo-stack";

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

// The card AND its buttons all carry data-project, so the attribute alone
// matches three elements and Playwright's strict mode refuses it. Scope to
// the card.
const CARD = `.lab-card[data-project="${PROJECT}"]`;

/** Polls the card's rendered text until `predicate` holds, or times out. */
async function waitForCard(page, predicate, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  let lastError = "";
  while (Date.now() < deadline) {
    last = await page
      .locator(CARD)
      .innerText()
      .catch((error) => {
        // Surfaced rather than swallowed: silently treating a selector
        // problem as "empty card" cost a debugging round the first time.
        lastError = error.message.split("\n")[0];
        return "";
      });
    if (predicate(last)) return last;
    await page.waitForTimeout(1000);
  }
  throw new Error(
    `timed out; last card text was:\n${last || "(empty)"}` +
      (lastError ? `\n  last selector error: ${lastError}` : ""),
  );
}

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });

  await check("the Lab section renders a card per demo project", async () => {
    await page.waitForSelector(CARD, { timeout: 15_000 });
  });

  await check("a stopped project offers an enabled Start button", async () => {
    await waitForCard(page, (t) => t.includes("Stopped"), 30_000);
    const start = page.locator(`button[data-action="start"][data-project="${PROJECT}"]`);
    assert.equal(await start.isDisabled(), false, "Start should be enabled while stopped");
  });

  await check("no demo link is offered before the stack is usable", async () => {
    const link = page.locator(`${CARD} .lab-open`);
    assert.equal(await link.count(), 0, "Open demo link must not be shown for a stopped project");
  });

  await check("starting it moves the card through its real states", async () => {
    await page.locator(`button[data-action="start"][data-project="${PROJECT}"]`).click();
    await waitForCard(page, (t) => /Starting|Running/.test(t));
  });

  await check("the phase line reports what the app is doing", async () => {
    // The whole point of the phase protocol: something more specific than
    // "Running" while the stack is still filling in.
    const text = await waitForCard(page, (t) => /Populating data|Ready|Idle/.test(t));
    assert.match(text, /Populating data|Ready|Idle/);
  });

  await check("a running demo shows its auto-stop countdown", async () => {
    const text = await waitForCard(page, (t) => t.includes("Stops automatically in"));
    assert.match(text, /Stops automatically in \d+[hms]/);
  });

  await check("the demo link appears once it is actually usable", async () => {
    await waitForCard(page, (t) => t.includes("Open demo"));
  });

  await check("stopping it is offered and works", async () => {
    const stop = page.locator(`button[data-action="stop"][data-project="${PROJECT}"]`);
    assert.equal(await stop.isDisabled(), false, "Stop should be enabled while running");
    await stop.click();
    await waitForCard(page, (t) => /Stopping|Stopped/.test(t));
  });

  await check("the page logged no uncaught errors", async () => {
    assert.deepEqual(consoleErrors, []);
  });
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll Lab checks passed.");
