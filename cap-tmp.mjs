import { chromium } from "playwright";
const url = "http://localhost:4180/";
const dir = "/home/agent/work/portfolio/docs/screenshots";
const b = await chromium.launch({ executablePath: "/opt/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell" });

async function walk(p) {
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 350) { await p.evaluate(v => window.scrollTo(0, v), y); await p.waitForTimeout(260); }
  await p.waitForTimeout(9000);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(800);
}

async function shot(p, width, out) {
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.setViewportSize({ width, height: Math.min(h, 12000) });
  await p.waitForTimeout(6000);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out });
}

const d = await b.newPage({ viewport: { width: 1440, height: 900 } });
await d.goto(url, { waitUntil: "networkidle" });
await d.waitForTimeout(1200);
await d.screenshot({ path: `${dir}/desktop.png` });
await walk(d);
await shot(d, 1440, `${dir}/desktop-full.png`);
await d.close();

const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await m.goto(url, { waitUntil: "networkidle" });
await m.waitForTimeout(1200);
await m.screenshot({ path: `${dir}/phone.png` });
await walk(m);
await shot(m, 390, `${dir}/phone-full.png`);
await m.close();
await b.close();
console.log("ok");
