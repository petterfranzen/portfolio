# Lighthouse

Measured with the Lighthouse CLI against the **production build**, served by
`vite preview` — not the dev server. Two documents are measured: the five-act
page (`/`) and the prose page (`/how-this-was-built/`).

- **CLI version: `lighthouse@13.6.0`** (published 2026-10-27; pinned, and older
  than a day at the time of the run).
- **Date: 2026-11-08.**
- **Machine: the section9 build sandbox** — `cpu.max = 40000 100000` (0.40 CPU),
  3.9 GiB RAM, one Chrome at a time, software rendering. See *Performance,
  honestly* below before quoting the Performance column.

## How to reproduce

```bash
npm run build
npx vite preview --port 4241 --strictPort &   # wait for http://localhost:4241/

# mobile (the CLI's default, Moto-G-class emulation)
npx --yes lighthouse@13.6.0 http://localhost:4241/ \
  --quiet --output=json --output-path=./mobile.json \
  --only-categories=performance,accessibility,best-practices \
  --throttling-method=simulate \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"

# desktop: add --preset=desktop
# the prose page: http://localhost:4241/how-this-was-built/
```

In this sandbox the browser is the Playwright headless shell
(`/opt/ms-playwright/chromium_headless_shell-1248/.../chrome-headless-shell`),
passed to the CLI as `CHROME_PATH`.

## Scores

| Document | Form factor | Performance | Accessibility | Best Practices |
| --- | --- | --- | --- | --- |
| `/` | mobile | 69 | **100** | **100** |
| `/` | desktop | 80 | **100** | **100** |
| `/how-this-was-built/` | mobile | 79 | **100** | **100** |
| `/how-this-was-built/` | desktop | 70 | **100** | **100** |

Both targets in the task — at least 95 for Accessibility and Best Practices —
are met on both documents, in both form factors.

Supporting metrics: first contentful paint 0.2–0.9 s, largest contentful paint
0.2–0.9 s, cumulative layout shift **0** on all four runs.

## What changed

Before this pass, the same runs scored **Accessibility 90** on mobile
(`/`), with two failing audits and no others:

| Audit | Finding |
| --- | --- |
| `button-name` | The "Jump to" button had no accessible name on a phone. |
| `link-name` | The brand link had no accessible name on a phone. |

Both came from one mistake: `@media (max-width: 620px)` hid `.brand-name` and
`.chip-label` with `display: none`, which takes the text out of the accessibility
tree as well as off the screen. They are now hidden visually (clipped, one pixel)
instead of removed, so the controls keep their names. Pinned by the smoke test's
phone check, which asserts the *rendered* text of both controls is non-empty —
the `display: none` version fails it.

The rest of the pass:

- **Images.** Two 1440×900 WebP captures of Flight Tracker were served at full
  size everywhere (144 kB each). Each now has 720 px and 1024 px siblings, and
  the `<img>`s carry `srcset`/`sizes` and `loading="lazy"`. A phone run now
  fetches the 720 px candidate (47 kB each); a desktop run fetches none at all,
  because the captures sit below the fold and a Lighthouse run never scrolls to
  them. This was the "Est savings of 223 KiB" line in the first report.
- **Landmarks.** The page had `<header>`, `<nav>` and `<main>` but no
  `<footer>`; it has one now, containing the link to the prose page. Two `nav`
  landmarks are distinguished by `aria-label` ("Acts", "Elsewhere").
- **Also checked and already correct**, so left alone: contrast (`color-contrast`
  passes on both themes), heading order, alt text, tap targets (`target-size`
  passes at 44 px), the skip link, focus visibility, landmarks, and
  `prefers-reduced-motion`, which already zeroes the pointer *and* scroll
  parallax on the atmosphere layers. No web fonts are used at all — the page
  asks the system for a stack — so there is no font-loading cost to fix.

## Performance, honestly

**The Performance column is not a measurement of the site.** The sandbox has
0.40 of a CPU and renders in software, so every script-second is multiplied;
Lighthouse's simulated throttling then multiplies it again. Total blocking time
is the whole story: 0.9–3.1 s on this box for a bundle of 14 kB of JavaScript
plus 30 kB of CSS, and it swings by more than 2 s between two runs of the very
same page (desktop `/` measured 78, 80 and 91 across runs; mobile
`/how-this-was-built/` measured 70 and 79). A real CI runner or a phone will not
reproduce these numbers.

What the run does say honestly:

- The page is small: ~20 kB of HTML, ~30 kB of CSS and ~14 kB of JS, all
  compressed to under 20 kB over the wire for the first view.
- Nothing blocks the first paint beyond the stylesheet (~60 ms estimated
  savings), and there is no layout shift at all.
- No third-party requests, no web fonts, and no image downloads until the
  visitor scrolls near them.

The remaining flagged items are `total-blocking-time` and `speed-index` —
CPU-bound, sandbox-bound, and not worth chasing here.
