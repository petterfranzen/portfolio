// Smoke test for the built site: it serves, the Demos list renders, and the
// health endpoint the VM's sync relies on answers. Driven with Playwright
// against the container or `npm run preview` (see README).
import { chromium } from "playwright";

const base = process.env.PORTFOLIO_URL ?? "http://127.0.0.1:8099";

const failures = [];
function check(ok, what) {
  if (ok) {
    console.log(`  ok   ${what}`);
  } else {
    failures.push(what);
    console.log(`  FAIL ${what}`);
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(base, { waitUntil: "domcontentloaded" });

  check((await page.title()).length > 0, "the page has a title");
  check(await page.locator("#demos").isVisible(), "the Demos section is present");
  check(
    (await page.locator("text=Contact").count()) > 0,
    "the Contact section is present",
  );

  // Either the baked list rendered a card, or the section says it has nothing
  // to list. Both are correct: the list is baked at build time, and an empty
  // bake (a Pages blip) must read as a quiet section, not a broken page.
  const cards = await page.locator(".demo-card").count();
  const fallback = await page.locator("#demos-list .lab-status").count();
  check(
    cards > 0 || fallback > 0,
    `the Demos list renders (cards: ${cards}, fallback: ${fallback})`,
  );

  // Under nginx this is the real endpoint; under `vite preview` the SPA
  // fallback answers it. Either way the site must serve a 200.
  const health = await page.request.get(`${base}/healthz`);
  check(health.status() === 200, "/healthz answers 200");

  await page.waitForTimeout(200);
  check(
    pageErrors.length === 0,
    `no uncaught page errors${pageErrors.length ? `: ${pageErrors[0]}` : ""}`,
  );
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
