import { chromium } from "playwright";
const url = "http://localhost:4180/";
const out = "/home/agent/work/t52";
const b = await chromium.launch({ executablePath: "/opt/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell" });
const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await m.goto(url, { waitUntil: "networkidle" });
const h = await m.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < h; y += 300) { await m.evaluate(v => window.scrollTo(0, v), y); await m.waitForTimeout(250); }
await m.waitForTimeout(4000);
for (const [name, sel] of [["m-hero", ".hero"], ["m-showcase", ".showcase"], ["m-tiles", ".experiments-grid"], ["m-contact", "#contact"]]) {
  await m.locator(sel).scrollIntoViewIfNeeded();
  await m.waitForTimeout(400);
  await m.locator(sel).screenshot({ path: `${out}/${name}.png` });
}
await b.close();
console.log("ok");
