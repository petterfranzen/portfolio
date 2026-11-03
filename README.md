# Portfolio

Personal portfolio and CV website for Petter Franzén — a single-page static
site with a hero/intro, an About/CV section (experience, education, skills),
a projects showcase, a list of demos and nightly experiments, and a contact
section.

It is served as one static nginx container, live at
<https://www.pastabake.cloud>.

## Demos

The Demos section lists the small apps built one a night in
[ghost-in-the-machine](https://github.com/petterfranzen/ghost-in-the-machine),
published on GitHub Pages, plus a plain link to anything else that is live
(the flight tracker).

The nightly list grows by one every night, so it is **baked at build time**
rather than kept by hand here — and it is never fetched from GitHub by the
browser, so the section ships with the site and costs no requests.

`scripts/build-experiments.py` bakes that list. It reads the public Pages
index — the same page a visitor would see — and writes `public/experiments.json`,
which `src/demos.ts` fetches same-origin and renders. It runs in the image
build (`Dockerfile`) and in CI (`.github/workflows/ci.yml`), always before the
build, because Vite copies `public/` into `dist/` as it builds. It fails soft on
purpose: on any error it writes an empty list and the build continues, so a
Pages blip leaves an empty section rather than a broken site.
`public/experiments.json` is gitignored, so the copy in the repo can never go
stale.

There used to be an interactive **Lab** here, which started demo stacks on the
home NAS through docker-monitor's control API via an nginx `/lab-api/` proxy.
That is gone: this site now runs on a public VM, and publishing a
container-control API on a public box is not a trade worth making. docker-monitor
stays on the NAS for its alerting.

## Tech stack

**Vite + vanilla TypeScript**, no UI framework.

This is a content-first site whose only client-side state is a theme toggle, a
mobile nav toggle, a footer year, and the Demos list render. That doesn't need
React, Vue, or any component framework; it needs HTML, CSS, and a sprinkle of
JS. Vite gives a fast dev server with instant HMR and a tiny, dependency-free
production build (a few KB of HTML/CSS/JS, no framework runtime to ship), and
TypeScript adds just enough safety for the interactive bits without any real
maintenance overhead. This keeps the dependency footprint minimal and the whole
thing trivial to host anywhere that serves static files.

## Project structure

```
index.html      Page markup and content (all sections live here)
src/style.css   All styling, incl. light/dark theme tokens and responsive rules
src/main.ts     Theme toggle, mobile nav toggle, footer year, demos
src/demos.ts    Demos: renders the list baked into public/experiments.json
scripts/build-experiments.py  Bakes that list from the ghost-in-the-machine index
public/         Static assets served as-is (favicon); experiments.json is generated
nginx.conf      Serves the built site, plus a plain /healthz
Dockerfile      Build the bundle, serve it from nginx
deploy/         Deployment (prebuilt image from GHCR)
tests/smoke.spec.mjs  One Playwright smoke test of the built site
```

## Running locally

```bash
npm install
python3 scripts/build-experiments.py   # bake the Demos list (optional)
npm run dev
```

This starts the Vite dev server (prints a local URL, typically
`http://localhost:5173`) with hot module reload. Without the bake the Demos
section says it has nothing to list; every other section is unaffected.

Other scripts:

```bash
npm run build     # type-check and build a production bundle into dist/
npm run preview   # serve the production build locally to sanity-check it
npm run test:smoke  # Playwright smoke test (needs a served build, see below)
```

To smoke-test a build:

```bash
python3 scripts/build-experiments.py
npm run build
npm run preview -- --port 8099 --strictPort &
PORTFOLIO_URL=http://127.0.0.1:8099 npm run test:smoke
```

## Design notes

- **Theming**: light/dark via CSS custom properties. Defaults to the visitor's
  OS preference (`prefers-color-scheme`) and can be overridden with the toggle
  in the header, which persists the choice in `localStorage`.
- **Responsive**: mobile-first layout with a collapsing nav (hamburger menu
  below 640px), a CV layout that stacks from two columns to one, and a project
  grid that reflows via `auto-fit`/`minmax`. Verified at both desktop and
  mobile (390px) viewport widths.
- **Reduced motion**: smooth scrolling is off when the visitor asks for it.
- **Accessibility**: WCAG AA text contrast in both themes, a skip link, and a
  44px tap floor on links and menu rows at phone widths.
- **No backend.** Content lives directly in `index.html`, with one exception:
  the Demos list is baked at build time (see above) and served as a static
  file. The browser never calls GitHub.

## Content still to fill in

Everything in the Projects section is real. The "About & CV" and "Contact"
sections contain real content; no placeholders remain. Anything you want to
change (photo, additional projects, updated experience) is plain HTML in
`index.html`.

Vim Quest is marked "Not yet deployed" rather than linked: it has no public
URL.

## Deployment

Built and pushed to GHCR by CI, then pulled and run as a container — on the
Hetzner VM for production, on the home NAS as the older route. See
[`deploy/README.md`](deploy/README.md).
