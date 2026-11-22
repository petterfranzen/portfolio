# Portfolio — Section 9

Petter Franzén's portfolio: an engineering manager's lab. One long page, five
acts, three experiments — each with the question it is testing — plus a short
prose page at `/how-this-was-built/` that explains the crew behind it.
Professional tone, experimental touches, no framework.

- **01 Boot** — a terminal boot sequence resolves into the name (a decode
  scramble on *Petter Franzén*), then the pitch types in. The grid and glow
  behind it move at different rates to the pointer.
- **02 Section 9** — how one person runs a small team of AI agents. A pinned
  loop lights stage by stage as you scroll: task, pull, build, QA, review,
  measure. Under it, unpinned: the crew (from `content/crew.json`) and what
  gets measured — budget, models, timeouts and the Code Health hypothesis.
- **03 Flight Tracker** — the experiment that got the most thought. Full
  bleed: animated flight arcs on a canvas, a cross-fading capture of the real
  app, the link out, and a panel of the architecture choices it tests.
- **04 Nightly experiments** — a horizontal filmstrip that scrubs sideways as
  you scroll down. Each tile is a night with a screenshot, its language, idea
  and verdict, and a link to the app on GitHub Pages; the one under the centre
  line offers a lazy live preview over its screenshot. Under it: the
  newest nights that were liked, with the verdict that says so.
- **05 Sign-off** — quiet close: LinkedIn, one line, the theme switch.

A footer closes the page with the link to the prose page, and the command
palette (`K` or `/`) lists both the acts and that page.

## How the build-time content works

Two things must not go stale by hand: the nightly experiments and the numbers
shown in acts 1–2. Both come from data, not from typing in this repo.

`scripts/build-experiments.mjs` runs as `prebuild`. It makes public reads of
[ghost-in-the-machine](https://github.com/petterfranzen/ghost-in-the-machine):
the `nights/` directory listing (which nights exist) and each night's
`nights/<folder>/night.json` (date, language, idea, verdict). A night without a
`night.json` falls back to its row in the older `LOG.md` table. Each night also
gets a `standing` — liked, reviewed or pending — read off its verdict — and a
`thumbnail` when a screenshot is committed at `public/nights/<folder>.webp`
(640×400 WebP, served from this site; a night without one gets a text tile).
The result is `src/experiments.generated.json`. That file is committed, so an
offline build still ships a list; if the reads fail the script keeps the
committed copy and warns rather than failing the build. Set `GITHUB_TOKEN` to
lift the anonymous API rate limit.

`content/crew.json` holds the agents and one line each about what they do,
written from the briefs in
[agent-manager](https://github.com/petterfranzen/agent-manager) (`agents/`).

`vite.config.ts` runs a small plugin at build time that bakes all of it into
the HTML: the tiles and their verdicts, the standout nights (the newest ones
whose standing is "liked"), the crew cards, and every count on the page —
agents, nights, languages, nights with a verdict, and the "four" in the
Section 9 headline. The browser never calls GitHub, and the page reads with
JavaScript off. No numbers in the copy are hand-maintained.

The prose in acts 2 and 3 is hand-written, and every claim in it comes from a
public repository: agent-manager's `docs/DESIGN.md` and `docs/DECISIONS.md`,
and flight-tracker's `README.md`. Check it against those when they change.

## Tech

**Vite + vanilla TypeScript**, no UI framework. Production output is roughly
42 kB HTML, 34 kB CSS and 18 kB JS before gzip (~8.3 / 7.8 / 7.0 kB gzipped).

The scroll work is CSS first:

- `animation-timeline: view()` drives the pinned pipeline's progress line and
  stage lighting, the filmstrip's horizontal travel, and the Flight Tracker
  still cross-fade. Named view timelines are declared on the tall sections so
  the sticky children share one progress clock.
- Where the browser cannot do that, `src/pipeline.ts` and `src/filmstrip.ts`
  do the same from one shared scroll frame in `src/rail.ts`. The two never fight:
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
how-this-was-built/index.html  The prose page about the crew
src/style.css                  All styling, both themes, scroll-driven plumbing
src/main.ts                    Entry point: starts each module below
src/dom.ts                     Shared DOM helpers and media queries
src/atmosphere.ts              Pointer depth for the background layers
src/boot.ts                    Act 1: the boot sequence
src/rail.ts                    The rail, scroll progress and act jumps
src/pipeline.ts                Act 2: the loop's fallback lighting
src/filmstrip.ts               Act 4: strip fallback, centre tile, previews
src/palette.ts                 The command palette
src/page.ts                    The prose page's entry point
src/theme.ts                   Theme and view transitions, shared by both pages
src/flight.ts                  The Flight Tracker canvas backdrop
src/experiments.ts             Typed access to the generated list
src/experiments.generated.json Generated at build time; do not edit by hand
scripts/build-experiments.mjs  Builds that list from ghost-in-the-machine
content/crew.json              The Section 9 agents and their lines
vite.config.ts                 Bakes content into the HTML at build time
public/apps/                   Captures of the live Flight Tracker, three widths
tests/smoke.spec.mjs           The visitor journey, including the hard rules
docs/lighthouse.md             The accessibility and Lighthouse pass, with scores
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
npm run build            # generate the night list, type-check, build into dist/
npm run preview          # serve the production build locally
npm run test:lab         # the smoke test, against a running preview
npm run test:headers     # nginx headers + CSP vs every page's scripts
node tests/serve-dist.mjs  # serve dist/ with the nginx headers, as CI does
npm run experiments:check  # fail if the committed night list is stale
```

The smoke test needs a server: `npm run build && npm run preview`, then in
another shell `PORTFOLIO_URL=http://localhost:4173 npm run test:lab`.

## Accessibility and motion

- Lighthouse 13.6.0 against the production build: **Accessibility 100 and Best
  Practices 100** on both documents, mobile and desktop. Performance is reported
  honestly in [`docs/lighthouse.md`](docs/lighthouse.md) — the numbers come from
  a 0.40-CPU sandbox and are not a measurement of the site.
- Dark and light themes both meet WCAG AA for every text colour; the toggle is
  in the top bar and in the sign-off, and it is shared between the two pages.
- The wordmark and the "Jump to" label are hidden *visually* on a phone rather
  than with `display: none`, so both controls keep their accessible names.
- Keyboard focus is always visible; the skip link, the palette, the rail and
  the night list are all usable without a pointer; tap targets are at least
  44 px.
- `prefers-reduced-motion: reduce` removes pinning, scrubbing, scramble and
  typing, and leaves the five acts as ordinary stacked sections with the same
  content. Previews are never autoplayed.
- With JavaScript off the page is a plain readable document; the boot text, the
  pipeline, both showcases and the sign-off are all in the HTML.

## Continuous integration

Every pull request runs `.github/workflows/ci.yml`: `tsc` and a production
build, then `npm run test:headers` (the nginx headers, and every script in
every built page checked against the CSP's `script-src`), then the smoke test
against `dist/` served by `tests/serve-dist.mjs`, which sends the same headers
nginx does — so a script the CSP would block fails the build.
Publishing the image stays a separate workflow, `docker-publish.yml`, and it
runs only on a push to `main` — never on a branch, a tag or a manual dispatch.

## Deployment

Runs on the same home NAS as the other projects, as a container: CI builds an
image and pushes it to GHCR, the NAS pulls it — the same pipeline flight-tracker
and docker-monitor use. See [`deploy/README.md`](deploy/README.md).

The page is entirely static now; the Lab and its `/lab-api/` proxy are gone
with the earlier landing page. The image is still built and published the same
way, so the deploy path did not change.

How a deploy is triggered: merging a PR to `main` runs `docker-publish.yml`,
which builds the image and pushes exactly one immutable tag, `sha-<short>`
(`latest` is not published). The job runs in the `production` environment, so
the repo's deployment-branch rule (`main`) applies as well as the workflow's
own `main`-only trigger. The NAS runs the tag you name: set `IMAGE_TAG` to the
`sha-<short>` from that run and `docker compose up -d` (see
[`deploy/README.md`](deploy/README.md)). Nothing on the NAS is rebuilt, and no
moving tag is involved.
