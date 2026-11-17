/**
 * A short journey through Section 9, against a real build.
 *
 * Not a unit test: what matters is what a visitor gets — five acts, the right
 * public links and no personal contact details, no errors, no sideways scroll
 * on the narrow screens, and a page that still reads with JavaScript off.
 *
 *   npm run build && npm run preview
 *   PORTFOLIO_URL=http://localhost:4173 node tests/smoke.spec.mjs
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

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

async function open(options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (!message.location().url.startsWith(BASE)) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
  return { context, page, errors };
}

await check("the page renders five acts and the name", async () => {
  const { context, page } = await open();
  await page.waitForFunction(() => !document.querySelector(".decode[data-decoding]"));
  assert.match(await page.title(), /Petter Franzén/);
  assert.equal((await page.locator("h1").innerText()).replace(/\s+/g, " ").trim(), "Petter Franzén");
  assert.equal(await page.locator("main .act").count(), 5);
  for (const id of ["act-1", "act-2", "act-3", "act-4", "act-5"]) {
    assert.ok(await page.locator(`#${id}`).count() === 1, `missing #${id}`);
  }
  const text = await page.locator("body").innerText();
  assert.match(text, /Engineering Manager/);
  assert.match(text, /Principal Engineer/);
  assert.match(text, /Solutions Architect/);
  assert.match(text, /Stockholm/i);
  await context.close();
});

await check("only public, ready apps are linked", async () => {
  const { context, page } = await open();
  const hrefs = await page
    .locator("a[href^='http']")
    .evaluateAll((links) => links.map((link) => link.href));
  assert.ok(hrefs.some((href) => href.startsWith("https://flight.pastabake.cloud")));
  assert.ok(hrefs.some((href) => href.includes("linkedin.com/in/petterf")));
  assert.ok(hrefs.some((href) => href.startsWith("https://petterfranzen.github.io/ghost-in-the-machine/")));
  assert.ok(!hrefs.some((href) => /vim-quest|docker-monitor|dinner|localhost/i.test(href)));
  await context.close();
});

await check("no email, phone or company names are published", async () => {
  const { context, page } = await open();
  const text = await page.locator("body").innerText();
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(text), "an email address is on the page");
  const withoutDates = text.replace(/\d{4}-\d{2}-\d{2}/g, "");
  assert.ok(!/(?:\+?\d[\d\s().-]{7,}\d)/.test(withoutDates), "a phone number is on the page");
  for (const name of ["Google", "Amazon", "Spotify", "Klarna", "Ericsson", "Microsoft", "Apple", "Meta"]) {
    assert.ok(!new RegExp(`\\b${name}\\b`, "i").test(text), `a company name is on the page: ${name}`);
  }
  await context.close();
});

await check("nothing throws, and no request leaves the page", async () => {
  const { context, page, errors } = await open();
  await page.waitForTimeout(3200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  assert.deepEqual(errors, []);
  const thirdParty = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(BASE) && !url.startsWith("data:")) thirdParty.push(url);
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  assert.deepEqual(thirdParty, []);
  await context.close();
});

await check("no sideways scroll at 1280, 390, 360 and 320", async () => {
  for (const width of [1280, 390, 360, 320]) {
    const { context, page } = await open({ viewport: { width, height: 800 } });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      window.scrollTo(600, 0);
      const moved = window.scrollX;
      window.scrollTo(0, 0);
      return {
        scroll: doc.scrollWidth,
        body: document.body.scrollWidth,
        client: doc.clientWidth,
        moved,
      };
    });
    assert.ok(
      overflow.scroll <= overflow.client + 1,
      `${width}px: document scrolls sideways (${overflow.scroll} > ${overflow.client})`,
    );
    assert.ok(
      overflow.body <= overflow.client + 1,
      `${width}px: body scrolls sideways (${overflow.body} > ${overflow.client})`,
    );
    assert.equal(overflow.moved, 0, `${width}px: the page can be panned sideways`);
    await context.close();
  }
});

await check("reduced motion leaves the acts stacked and readable", async () => {
  const { context, page } = await open({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.querySelectorAll(".stage.is-live").length === 6,
    null,
    { timeout: 3000 },
  );
  const positions = await page.locator(".act").evaluateAll((acts) =>
    acts.map((act) => getComputedStyle(act).position),
  );
  assert.ok(!positions.includes("sticky"), "an act is still pinned under reduced motion");
  const stages = await page.locator(".stage.is-live").count();
  assert.equal(stages, 6, "the pipeline should simply be lit, not scrubbed");
  const pitch = await page.locator("#pitch").innerText();
  assert.match(pitch, /^Engineering leader\./);
  const term = await page.locator("#boot-log").innerText();
  assert.match(term, /section9\.boot/);
  await context.close();
});

await check("the page reads with JavaScript off", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const text = await page.locator("body").innerText();
  assert.match(text, /Petter Franzén/);
  assert.match(text, /Engineering leader/);
  assert.match(text, /Flight Tracker/);
  assert.match(text, /Lantern Moss/);
  assert.match(text, /linkedin\.com\/in\/petterf/);
  const hrefs = await page.locator("a[href^='http']").evaluateAll((links) => links.map((link) => link.href));
  assert.ok(hrefs.some((href) => href.startsWith("https://flight.pastabake.cloud")));
  await context.close();
});

await check("the command palette jumps to an act and closes", async () => {
  const { context, page } = await open();
  await page.keyboard.press("k");
  const palette = page.locator("#palette");
  assert.ok(await palette.isVisible(), "the palette did not open");
  await page.locator("#palette-input").fill("flight");
  await page.waitForTimeout(120);
  const options = await page.locator(".palette-item").count();
  assert.ok(options >= 2, `expected act and app, got ${options}`);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  assert.ok(!(await palette.isVisible()), "the palette stayed open");
  await context.close();
});

await check("the flight capture cross-fades as its act is scrolled", async () => {
  const { context, page } = await open();
  const opacity = () =>
    page.locator(".shot-b").evaluate((el) => Number(getComputedStyle(el).opacity));
  const act = await page.evaluate(() => document.querySelector("#act-3").offsetTop);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), act - 200);
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector(".shot-b")).opacity) < 0.05,
    null,
    { timeout: 3000 },
  );
  const before = await opacity();
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), act + 420);
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector(".shot-b")).opacity) > 0.9,
    null,
    { timeout: 3000 },
  );
  const after = await opacity();
  assert.ok(before < 0.05, `the first capture should own the frame at the start (was ${before})`);
  assert.ok(after > 0.9, `the second capture should fade in as the act is scrolled (was ${after})`);
  await context.close();
});

await check("phone copy is 16px and the brand is a 44px target", async () => {
  const { context, page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const sizes = await page.evaluate(() => {
    const px = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return {
      stage: px(".stage-line"),
      lead: px(".act-lead"),
      eyebrow: px(".eyebrow"),
      idea: px(".tile-idea"),
      brand: document.querySelector(".brand").getBoundingClientRect(),
    };
  });
  for (const [name, size] of Object.entries(sizes)) {
    if (name === "brand") continue;
    assert.ok(size >= 16, `${name} copy is ${size}px on a phone`);
  }
  assert.ok(sizes.brand.width >= 44 && sizes.brand.height >= 44, `brand target is ${Math.round(sizes.brand.width)}x${Math.round(sizes.brand.height)}`);

  // The wordmark and the "Jump to" label are too wide for a phone, so they are
  // hidden visually — but they carry the controls' accessible names, and a
  // display:none would leave the button and the link unnamed (Lighthouse's
  // button-name and link-name audits). Pin the rendered text, not the text
  // content, so hiding by display:none fails here.
  const named = {
    brand: (await page.locator(".brand").innerText()).trim(),
    jump: (await page.locator("#palette-open").innerText()).trim(),
  };
  assert.ok(named.brand.length > 0, "the brand link has no rendered text, so no accessible name, on a phone");
  assert.ok(named.jump.length > 0, "the jump button has no rendered text, so no accessible name, on a phone");

  await context.close();
});

await check("the rail reserves its own column at 1280", async () => {
  const { context, page } = await open({ viewport: { width: 1280, height: 800 } });
  const geometry = await page.evaluate(() => {
    const rail = document.querySelector(".rail").getBoundingClientRect();
    const content = ["#name", "#model-title", ".flight-copy", "#nights-title", "#signoff-title"]
      .map((selector) => document.querySelector(selector).getBoundingClientRect())
      .map((box) => ({ left: box.left, width: box.width }));
    return { railRight: rail.right, railWidth: rail.width, content };
  });
  assert.ok(geometry.railWidth > 0, "the rail is not rendered at 1280");
  for (const box of geometry.content) {
    assert.ok(box.left >= geometry.railRight, `content starts at ${Math.round(box.left)}, rail ends at ${Math.round(geometry.railRight)}`);
  }
  await context.close();
});

await check("the theme switch flips the document theme", async () => {
  const { context, page } = await open();
  const before = await page.locator("html").getAttribute("data-theme");
  await page.locator("#theme-toggle").click();
  await page.waitForTimeout(600);
  const after = await page.locator("html").getAttribute("data-theme");
  assert.notEqual(after, before);
  assert.ok(["light", "dark"].includes(after));
  await context.close();
});

await check("keyboard only: the skip link, then the five acts", async () => {
  const { context, page } = await open({ viewport: { width: 1280, height: 800 } });
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => ({
    cls: document.activeElement?.className ?? "",
    href: document.activeElement?.getAttribute?.("href") ?? "",
  }));
  assert.match(first.cls, /skip-link/, `the first Tab landed on "${first.cls}", not the skip link`);
  const box = await page.locator(".skip-link").boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, "the skip link is not visible while focused");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash === "#act-1", null, { timeout: 4000 });

  const walked = [];
  for (let guard = 0; walked.length < 5 && guard < 40; guard += 1) {
    await page.keyboard.press("Tab");
    const act = await page.evaluate(() => {
      const el = document.activeElement;
      return el instanceof HTMLElement ? el.dataset.actLink ?? null : null;
    });
    if (!act) continue;
    walked.push(act);
    await page.keyboard.press("Enter");
    await page.waitForFunction((id) => location.hash === id, `#act-${act}`, { timeout: 4000 });
    const current = await page.evaluate(
      (id) => document.querySelector(`[data-act-link="${id}"]`)?.getAttribute("aria-current"),
      act,
    );
    assert.equal(current, "true", `act ${act} is not marked as current after the jump`);
  }
  assert.deepEqual(walked, ["1", "2", "3", "4", "5"], `the rail walked ${walked.join(",")} by keyboard`);
  await context.close();
});

await check("keyboard only: the nightly list is reachable and named", async () => {
  const { context, page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const nights = Number(await page.locator("#strip-count").innerText());
  assert.ok(nights > 0, "the strip reports no nights");
  const reached = [];
  for (let guard = 0; reached.length < nights && guard < 80; guard += 1) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const link = document.activeElement?.closest?.("a.tile-link");
      if (!link) return null;
      const title = link.querySelector(".tile-title")?.textContent?.trim() ?? "";
      const text = (link.getAttribute("aria-label") ?? link.textContent ?? "").replace(/\s+/g, " ").trim();
      return { title, text };
    });
    if (!name) continue;
    assert.ok(name.text.length > 0, "a nightly link has no accessible name");
    assert.ok(name.title.length > 0, "a nightly link has no visible title");
    reached.push(name.title);
  }
  assert.equal(reached.length, nights, `reached ${reached.length} of ${nights} nights by keyboard`);
  await context.close();
});

await check("the footer links to a working How this was built page", async () => {
  const { context, page } = await open();
  const link = page.locator("footer a[href='/how-this-was-built/']");
  assert.equal(await link.count(), 1, "the footer does not link to /how-this-was-built/");
  const text = await link.innerText();
  assert.match(text, /How this was built/);
  const footer = await page.locator("footer").evaluate((el) => el.tagName.toLowerCase());
  assert.equal(footer, "footer");
  await context.close();
});

await check("the command palette lists the How this was built page", async () => {
  const { context, page } = await open();
  await page.keyboard.press("k");
  await page.locator("#palette-input").fill("how this");
  await page.waitForTimeout(150);
  const labels = await page.locator(".palette-item").allInnerTexts();
  assert.ok(
    labels.some((label) => /How this was built/.test(label)),
    `the palette found ${JSON.stringify(labels)}`,
  );
  await page.keyboard.press("Escape");
  await context.close();
});

await check("the How this was built page reads and stays public-safe", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (!message.location().url.startsWith(BASE)) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${BASE}/how-this-was-built/`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  assert.match(await page.title(), /How this was built/);
  assert.equal((await page.locator("h1").innerText()).trim(), "How this was built");

  const words = (await page.locator("main").innerText()).split(/\s+/).filter(Boolean).length;
  assert.ok(words >= 400 && words <= 600, `the page runs to ${words} words, outside 400-600`);

  const text = await page.locator("body").innerText();
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(text), "an email address is on the page");
  assert.ok(!/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(text), "an IP address is on the page");
  assert.ok(!/\b(?:sk-|ghp_|gho_|github_pat_|Bearer )/i.test(text), "something token-shaped is on the page");
  for (const name of ["Google", "Amazon", "Spotify", "Klarna", "Ericsson", "Microsoft", "Apple", "Meta"]) {
    assert.ok(!new RegExp(`\\b${name}\\b`, "i").test(text), `a company name is on the page: ${name}`);
  }

  const external = await page
    .locator("a[href^='http']")
    .evaluateAll((links) => links.map((link) => link.href));
  for (const href of external) {
    assert.ok(
      href.startsWith("https://www.linkedin.com/in/petterf/"),
      `the page links out to ${href}, which is not on the allowed list`,
    );
  }

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert.ok(overflow.scroll <= overflow.client + 1, `the page scrolls sideways (${overflow.scroll} > ${overflow.client})`);
  assert.deepEqual(errors, []);
  await context.close();
});

await check("the theme is shared between the two pages", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/how-this-was-built/`, { waitUntil: "networkidle" });
  const toggle = page.locator("#theme-toggle");
  await toggle.click();
  const chosen = await page.locator("html").getAttribute("data-theme");
  assert.ok(["light", "dark"].includes(chosen), `the new page set theme "${chosen}"`);
  await page.goto(BASE, { waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), chosen, "the choice did not carry to the portfolio");
  await context.close();
});


await browser.close();

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nall checks passed");
}
