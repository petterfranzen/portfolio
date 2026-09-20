# Portfolio

Personal portfolio and CV website for Petter Franzén — a single-page static
site with a hero/intro, an About/CV section (experience, education, skills),
a projects showcase, and a contact section.

## The Lab

The projects here run on a home NAS, not a cloud host, so leaving them up
around the clock costs real resources (and, for the flight tracker, real
OpenSky API quota). The Lab section instead lets a visitor start one on
demand:

- Live state and, more usefully, a **phase** — "Populating data — global
  sweep" rather than just "Running". A freshly started flight tracker
  serves a page within seconds but shows an empty map for a minute while
  it backfills, and the phase is what explains that rather than leaving it
  looking broken.
- The **Open demo** link is withheld until the stack is genuinely usable,
  not merely healthy.
- Every demo **stops itself after an hour**, with the countdown on the card.
- One demo at a time; a visitor who arrives while another is running is
  told so.

None of this logic lives here. `src/lab.ts` renders what
[docker-monitor](../docker-monitor)'s control API reports, and posts
start/stop to it; the guest limits, leases and lifecycle are all enforced
there. This site reaches it at `/lab-api/`, proxied by its own nginx (see
`nginx.conf`) so the call is same-origin and docker-monitor is never
exposed to the internet directly.

With the NAS unreachable — it's a home server, it's sometimes off — the
Lab says so and the rest of the page is unaffected.

## Tech stack

**Vite + vanilla TypeScript**, no UI framework.

This is a content-first site whose only client-side state is a theme
toggle, a mobile nav toggle, a footer year, and the Lab's project cards.
That doesn't need React, Vue, or any component framework; it needs HTML,
CSS, and a sprinkle of JS. The Lab re-renders a handful of cards when a
server event lands, which is not a reason to introduce a framework. Vite gives a fast dev server with instant HMR and a tiny, dependency-free
production build (a few KB of HTML/CSS/JS, no framework runtime to ship),
and TypeScript adds just enough safety for the interactive bits without any
real maintenance overhead. This keeps the dependency footprint minimal and
the whole thing trivial to host anywhere that serves static files.

## Project structure

```
index.html      Page markup and content (all sections live here)
src/style.css   All styling, incl. light/dark theme tokens and responsive rules
src/main.ts     Theme toggle, mobile nav toggle, footer year
src/lab.ts      The Lab: live project status and start/stop, via /lab-api/
public/         Static assets served as-is (favicon)
nginx.conf      Serves the built site; proxies /lab-api/ to docker-monitor
Dockerfile      Build the bundle, serve it from nginx
deploy/         NAS deployment (prebuilt image from GHCR)
tests/lab.spec.mjs  One Playwright journey through the Lab
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
npm run test:lab  # Playwright journey through the Lab (needs the stack below)
```

The Lab needs docker-monitor to talk to. Without it, the dev server still
runs and every other section works — the Lab just reports the NAS as
unreachable, which is exactly what a visitor would see.

### Running the Lab locally

Bring both containers up on a shared network so nginx can resolve
`docker-monitor` by name, with a `projects.json` listing something
startable (see docker-monitor's `projects.example.json`):

```bash
docker network create lab-test

docker run -d --rm --name docker-monitor --network lab-test \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD"/projects.json:/config/projects.json:ro \
  -v "$PWD"/stacks:/stacks:ro \
  -e PROJECTS_FILE=/config/projects.json -e TRUST_PROXY_HEADERS=true \
  ghcr.io/petterfranzen/docker-monitor:latest

docker build -t portfolio:test .
docker run -d --rm --name portfolio --network lab-test -p 8099:80 portfolio:test
```

Then `http://localhost:8099`, or `PORTFOLIO_URL=http://localhost:8099 npm
run test:lab` to drive the journey test against it.

## Design notes

- **Theming**: light/dark via CSS custom properties. Defaults to the
  visitor's OS preference (`prefers-color-scheme`) and can be overridden
  with the toggle in the header, which persists the choice in
  `localStorage`.
- **Responsive**: mobile-first layout with a collapsing nav (hamburger menu
  below 640px), a CV layout that stacks from two columns to one, and a
  project grid that reflows via `auto-fit`/`minmax`. Verified at both
  desktop and mobile (390px) viewport widths.
- **No backend, no build-time data fetching** — content lives directly in
  `index.html`.

## Content still to fill in

Everything in the Projects section is real, and the "Coming soon" badges
are gone — Dinner Planner and Vim Quest are both built and described
properly now. The "About & CV" and "Contact" sections contain real
content; no placeholders remain. Anything you want to change (photo,
additional projects, updated experience) is plain HTML in `index.html`.

Vim Quest is marked "Not yet deployed" rather than linked: it has no
Dockerfile, so it can't appear in the Lab until it gets one.

## Deployment

Runs on the same home NAS as the other projects, as a container: CI builds
an image and pushes it to GHCR, the NAS pulls it — the same pipeline
flight-tracker and docker-monitor use. See [`deploy/README.md`](deploy/README.md).

The Lab is why this is a container rather than a bucket of static files on
Netlify or Pages: it needs an nginx in front to proxy `/lab-api/` to
docker-monitor on the NAS's own network. A purely static host would mean
exposing docker-monitor's API to the internet directly and dealing with
CORS, which is a worse trade for something that can start and stop
containers.

**Before exposing this publicly**, read docker-monitor's "Security notes",
particularly the `TRUST_PROXY_HEADERS` point — this nginx is the only
intended way in, and the guest rate limits depend on that being true.
