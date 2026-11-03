/**
 * A short journey through the site, against a real build.
 *
 * Not a unit test: what matters here is what a visitor gets — the content is
 * there, the app links go where they say, the theme toggle works, nothing
 * throws, and the page doesn't scroll sideways on a phone.
 *
 * Run: npm run build && npm run preview, then
 *      PORTFOLIO_URL=http://localhost:4173 node tests/smoke.spec.mjs
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.PORTFOLIO_URL ?? "http://localhost:4173";
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

// CHROMIUM_PATH lets a machine with a system Chromium (or a differently
// versioned Playwright browser) run this without a download.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

async function open(options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  // Only this page's own errors: the experiment previews are third-party
  // pages in iframes and their console noise isn't ours to fix.
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (!message.location().url.startsWith(BASE)) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE, { waitUntil: "networkidle" });
  return { context, page, errors };
}

await check("the page renders its content", async () => {
  const { context, page } = await open();
  assert.match(await page.title(), /Petter Franzén/);
  assert.equal(await page.locator("h1").innerText(), "Petter\nFranzén");
  assert.ok(await page.locator("#work .work-item").count() === 2);
  assert.ok(await page.locator("#apps .showcase").isVisible());
  await context.close();
});

await check("the live app is linked, and only public apps are", async () => {
  const { context, page } = await open();
  const hrefs = await page.locator("a[href^='http']").evaluateAll((links) =>
    links.map((link) => link.href),
  );
  assert.ok(hrefs.includes("https://flight.pastabake.cloud/"));
  assert.ok(hrefs.some((href) => href.includes("linkedin.com/in/petterf")));
  assert.ok(
    hrefs.some((href) => href.startsWith("https://petterfranzen.github.io/")),
  );
  // Nothing that isn't reachable by the public belongs here.
  assert.ok(!hrefs.some((href) => /vim-quest|docker-monitor|dinner/i.test(href)));
  await context.close();
});

await check("no email address or phone number is published", async () => {
  const { context, page } = await open();
  const text = await page.locator("body").innerText();
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(text), "an email address is on the page");
  // Dates are the only long digit runs this page should contain.
  const withoutDates = text
    .replace(/\d{4}-\d{2}-\d{2}/g, "")
    .replace(/\d{4}–\d{4}/g, "");
  assert.ok(
    !/\+?\d[\d\s-]{7,}\d/.test(withoutDates),
    "something phone-shaped is on the page",
  );
  await context.close();
});

await check("the theme toggle switches and remembers", async () => {
  const { context, page } = await open();
  const before = await page.locator("html").getAttribute("data-theme");
  await page.locator("#theme-toggle").click();
  // With View Transitions the new theme lands a frame later, so wait for it.
  await page.waitForFunction(
    (was) => document.documentElement.dataset.theme !== was,
    before,
  );
  const after = await page.locator("html").getAttribute("data-theme");
  assert.notEqual(before, after);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), after);
  await context.close();
});

await check("nothing throws on load", async () => {
  const { context, errors } = await open();
  assert.deepEqual(errors, []);
  await context.close();
});

for (const width of [320, 360, 390]) {
  await check(`no sideways scroll at ${width}px`, async () => {
    const { context, page } = await open({
      viewport: { width, height: 780 },
      isMobile: true,
      hasTouch: true,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert.ok(overflow <= 0, `page is ${overflow}px wider than the viewport`);
    await context.close();
  });
}

await check("content is readable with JavaScript off", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  assert.ok(await page.locator("h1").isVisible());
  assert.ok(await page.locator("#work .work-item").first().isVisible());
  assert.ok(await page.locator("#apps .showcase").isVisible());
  const opacity = await page
    .locator("#work .work-item")
    .first()
    .evaluate((el) => getComputedStyle(el).opacity);
  assert.equal(opacity, "1");
  await context.close();
});

await check("reduced motion leaves the content in place", async () => {
  const { context, page } = await open({ reducedMotion: "reduce" });
  const opacity = await page
    .locator("#work .work-item")
    .first()
    .evaluate((el) => getComputedStyle(el).opacity);
  assert.equal(opacity, "1");
  await context.close();
});

await browser.close();

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
