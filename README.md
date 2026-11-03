# Portfolio — Section 9

Petter Franzén's portfolio: one long page, five acts, each pinned and scrubbed
by scroll. Professional tone, experimental touches, no framework.

- **01 Boot** — a terminal boot sequence resolves into the name (a decode
  scramble on *Petter Franzén*), then the pitch types in. The grid and glow
  behind it move at different rates to the pointer.
- **02 Operating model** — a pinned pipeline. A task enters, then Engineering,
  Research, Architecture and review, QA, ship. Each stage lights in turn as you
  scroll. The counts beside it are baked in at build time.
- **03 Flight Tracker** — full bleed: animated flight arcs on a canvas, a
  cross-fading capture of the real app, one line, and the link out.
- **04 Nightly experiments** — a horizontal filmstrip that scrubs sideways as
  you scroll down. Each tile is a night; the one under the centre line offers a
  lazy live preview. The list builds itself at build time.
- **05 Sign-off** — quiet close: LinkedIn, one line, the theme switch.

## How the build-time content works

Two things must not go stale by hand: the nightly experiments and the numbers
shown in acts 1–2. Both come from data, not from typing in this repo.

`scripts/build-experiments.mjs` runs as `prebuild`. It makes two public reads of
[ghost-in-the-machine](https://github.com/petterfranzen/ghost-in-the-machine):
the `nights/` directory listing (which nights exist) and `LOG.md` (the idea and
language for each), and writes `src/experiments.generated.json`. That file is
committed, so an offline build still ships a list; if the reads fail the script
keeps the committed copy and warns rather than failing the build. Set
`GITHUB_TOKEN` to lift the anonymous API rate limit.

`content/crew.json` holds the five agents and one line each about what they do.

`vite.config.ts` runs a small plugin at build time that bakes the experiments,
the crew count and the derived numbers directly into `index.html` and the
bundle. The browser never calls GitHub, and the page reads with JavaScript off.
No numbers in the copy are hand-maintained.

## Tech

**Vite + vanilla TypeScript**, no UI framework. Production output is roughly
19 kB HTML, 25 kB CSS and 15 kB JS before gzip (~4.5 / 6.3 / 6.0 kB gzipped).

The scroll work is CSS first:

- `animation-timeline: view()` drives the pinned pipeline's progress line and
  stage lighting, the filmstrip's horizontal travel, and the Flight Tracker
  still cross-fade. Named view timelines are declared on the tall sections so
  the sticky children share one progress clock.
- Where the browser cannot do that, `src/main.ts` runs a small scroll handler —
  gated by an IntersectionObserver — for the same states. The two never fight:
  the fallback only runs when support is missing.
- The dark/light switch and act jumps go through the View Transitions API where
  it exists and fall back to an instant change.
- A command palette opens on `K` or `/`, or the button in the top bar on touch.
  It filters acts and public apps and is fully keyboard driven.
- Pointer depth on desktop; scroll-driven depth on touch. Both off under
  `prefers-reduced-motion`, where the pinned acts become normal stacked
  sections and nothing scrambles or types.
- No third-party runtime requests. The experiment preview iframes mount only
  when a visitor presses *Play preview* on the centred tile.

## Project structure

```
index.html                     The five acts, in order
src/style.css                  All styling, both themes, scroll-driven plumbing
src/main.ts                    Boot sequence, rail, palette, theme, fallbacks
src/flight.ts                  The Flight Tracker canvas backdrop
src/experiments.ts             Typed access to the generated list
src/experiments.generated.json Generated at build time; do not edit by hand
scripts/build-experiments.mjs  Builds that list from ghost-in-the-machine
content/crew.json              The operating model's agents and lines
vite.config.ts                 Bakes content into the HTML at build time
public/apps/                   Two captures of the live Flight Tracker
tests/smoke.spec.mjs           The visitor journey, including the hard rules
nginx.conf                     Static file serving; long cache for hashed assets
Dockerfile                     Build the bundle, serve it from nginx
deploy/                        NAS deployment (prebuilt image from GHCR)
```

## Running locally

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build     # generate the night list, type-check, build into dist/
npm run preview   # serve the production build locally
npm test          # the smoke test, against a running preview
```

The smoke test needs a server: `npm run build && npm run preview`, then in
another shell `PORTFOLIO_URL=http://localhost:4173 npm test`.

## Accessibility and motion

- Dark and light themes both meet WCAG AA for every text colour; the toggle is
  in the top bar and in the sign-off.
- Keyboard focus is always visible; the palette and the rail are usable without
  a pointer; tap targets are at least 44 px.
- `prefers-reduced-motion: reduce` removes pinning, scrubbing, scramble and
  typing, and leaves the five acts as ordinary stacked sections with the same
  content. Previews are never autoplayed.
- With JavaScript off the page is a plain readable document; the boot text, the
  pipeline, both showcases and the sign-off are all in the HTML.

## Deployment

Runs on the same home NAS as the other projects, as a container: CI builds an
image and pushes it to GHCR, the NAS pulls it — the same pipeline flight-tracker
and docker-monitor use. See [`deploy/README.md`](deploy/README.md).

The page is entirely static now; the Lab and its `/lab-api/` proxy are gone
with the earlier landing page. The image is still built and published the same
way, so the deploy path did not change.
