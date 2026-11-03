import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell" });
for (const theme of ["dark", "light"]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto("http://localhost:4180/", { waitUntil: "networkidle" });
  await p.evaluate(t => localStorage.setItem("portfolio-theme", t), theme);
  await p.reload({ waitUntil: "networkidle" });
  const res = await p.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/[\d.]+/g).map(Number);
      const s = c.startsWith("color(") ? 255 : 1;
      return { r: m[0] * s, g: m[1] * s, b: m[2] * s, a: m[3] ?? 1 };
    };
    const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const bgOf = (el) => { let n = el; while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0.5) return c; n = n.parentElement; } return { r: 8, g: 9, b: 12, a: 1 }; };
    const out = [];
    for (const el of document.querySelectorAll("p, h1, h2, h3, h4, a, span, li, time")) {
      if (!el.textContent.trim()) continue;
      if (el.children.length && !el.matches("a, span, li")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const size = parseFloat(cs.fontSize);
      const bold = +cs.fontWeight >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const cr = ratio(parse(cs.color), bgOf(el));
      const need = large ? 3 : 4.5;
      if (cr < need) out.push({ text: el.textContent.trim().slice(0, 40), cls: el.className, cr: +cr.toFixed(2), need, size });
    }
    return out;
  });
  console.log(theme, JSON.stringify(res));
  await p.close();
}
await b.close();
