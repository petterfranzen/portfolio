import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell" });
const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await m.goto("http://localhost:4180/", { waitUntil: "networkidle" });
await m.locator("#nav-toggle").click();
await m.waitForTimeout(400);
await m.screenshot({ path: "/home/agent/work/t52/m-nav.png" });
await b.close();
