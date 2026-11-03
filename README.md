# Portfolio

Personal site for Petter Franzén — a single static page: a parallax hero, two
recent gigs in one line each, a showcase for the live Flight Tracker, and the
nightly experiments as live-preview tiles.

No CV, no skills list, no education, no dates beyond the years. The point of
the page is the apps: everything on it is something a visitor can open.

## What's on it

- **Hero** — layered parallax (a glow, a grid and an outlined wordmark moving
  at different rates) driven by CSS scroll-driven animations where the browser
  supports them, with a small `requestAnimationFrame` fallback where it
  doesn't.
- **Work** — IAG / British Airways and notonthehighstreet, one line each.
- **Apps** — Flight Tracker, with a cross-fading capture of the live app and a
  link to it, then the nightly experiments.
- **Contact** — LinkedIn and "Stockholm". Nothing else: no email, no phone, no
  street address. Please keep it that way.

## Effects, and the rules they follow

Four, and no more: the hero parallax, scroll-linked reveals, a cursor-follow
spotlight on the apps section (desktop pointers only), and a View Transition on
the theme toggle.

All of them are off under `prefers-reduced-motion: reduce`, and none of them
carry content: the reveal styles only apply behind a `js` class set in the
document head, so with scripting off the page is simply a static, readable
document. Contrast is checked at WCAG AA in both themes, tap targets are at
least 44px, and the layout is verified at 320, 360 and 390px.

## Experiments

The Experiments section lists the nightly apps from
[ghost-in-the-machine](https://github.com/petterfranzen/ghost-in-the-machine),
which are published on GitHub Pages. That list grows by one every night, so it
is **generated at build time** rather than kept by hand here — and it is never
fetched by the browser, so the section ships with the bundle and costs no
requests.

`scripts/build-experiments.mjs` runs as `prebuild`, ahead of `tsc`, and makes
two public reads of that repo: the `nights/` directory listing (which night
folders actually exist) and `LOG.md` (the idea and the language for each). It
writes `src/experiments.generated.ts`, which `src/experiments.ts` renders as
tiles.

That generated file is committed, so a build with no network still ships a
list. When the reads fail — offline, or the API refusing — the script keeps the
committed copy and warns rather than failing the build. Set `GITHUB_TOKEN` in
the environment to lift the anonymous API rate limit if a build ever hits it.

Each tile loads a live preview of the published page in an iframe, lazily and
only once it is near the viewport. The iframe is inert (`pointer-events: none`,
`tabindex="-1"`, `aria-hidden`), so it can't swallow a phone scroll — the tile
itself is the link. Flight Tracker is *not* iframed: it may send
`X-Frame-Options`, so the showcase uses captured stills instead.

## Tech stack

**Vite + vanilla TypeScript**, no UI framework.

This is a content-first site whose only client-side state is a theme toggle, a
mobile nav toggle, a footer year, the scroll effects and the lazy previews.
That doesn't need React, Vue, or any component framework; it needs HTML, CSS,
and a sprinkle of JS. Vite gives a fast dev server with instant HMR and a tiny,
dependency-free production build (a few KB of HTML/CSS/JS, no framework runtime
to ship), and TypeScript adds just enough safety for the interactive bits
without any real maintenance overhead.

## Project structure

```
index.html      Page markup and content (all sections live here)
src/style.css   All styling: theme tokens, layout, the scroll effects
src/main.ts     Theme toggle, mobile nav, footer year, reveals, parallax fallback
src/experiments.ts             Experiments: renders the generated list as tiles
src/experiments.generated.ts   Generated at build time; do not edit by hand
scripts/build-experiments.mjs  Builds that list from the ghost-in-the-machine repo
public/apps/    Captured stills of the live Flight Tracker
public/         Static assets served as-is (favicon)
nginx.conf      Serves the built site
Dockerfile      Build the bundle, serve it from nginx
deploy/         NAS deployment (prebuilt image from GHCR)
tests/smoke.spec.mjs  One Playwright journey through the page
```

## Running locally

```bash
npm install
npm run dev
```

This starts the Vite dev server (prints a local URL, typically
`http://localhost:5173`) with hot module reload.

Other scripts:

```bash
npm run build     # type-check and build a production bundle into dist/
npm run preview   # serve the production build locally to sanity-check it
npm test          # Playwright smoke test against a running preview
```

The smoke test needs a served build:

```bash
npm run build && npm run preview &
PORTFOLIO_URL=http://localhost:4173 npm test
```

It checks the content renders, the app links point at public apps, no email or
phone number is published, the theme toggle works and persists, nothing throws,
there is no sideways scroll at 320/360/390px, the page is readable with
JavaScript off, and reduced motion leaves the content in place. Set
`CHROMIUM_PATH` if the machine's Playwright browser lives somewhere unusual.

## Design notes

- **Theming**: dark by default, light on request. The choice persists in
  `localStorage`; the toggle cross-fades between the two with a View
  Transition where the browser supports it.
- **No backend.** Content lives directly in `index.html`, with one exception:
  the Experiments list is generated at build time from the ghost-in-the-machine
  repo (see above) and baked into the bundle. The browser never calls GitHub.
- **No third-party runtime requests.** No web fonts, no analytics, no CDN. The
  only external requests are the experiment previews, which are the point.

## Deployment

Runs on the same home NAS as the other projects, as a container: CI builds an
image and pushes it to GHCR, the NAS pulls it — the same pipeline
flight-tracker and docker-monitor use. See [`deploy/README.md`](deploy/README.md).

`nginx.conf` still carries the `/lab-api/` proxy from the old Lab section. The
page no longer uses it; it is left in place so this change doesn't touch the
deployment path, and the Hetzner simplification removes it.
