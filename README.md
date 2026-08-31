# Portfolio

Personal portfolio and CV website for Petter Franzén — a single-page static
site with a hero/intro, an About/CV section (experience, education, skills),
a projects showcase, and a contact section.

## Tech stack

**Vite + vanilla TypeScript**, no UI framework.

This is a static, content-first site with no client-side state to speak of —
a theme toggle, a mobile nav toggle, and a footer year. That doesn't need
React, Vue, or any component framework; it needs HTML, CSS, and a sprinkle of
JS. Vite gives a fast dev server with instant HMR and a tiny, dependency-free
production build (a few KB of HTML/CSS/JS, no framework runtime to ship),
and TypeScript adds just enough safety for the interactive bits without any
real maintenance overhead. This keeps the dependency footprint minimal and
the whole thing trivial to host anywhere that serves static files.

## Project structure

```
index.html      Page markup and content (all sections live here)
src/style.css   All styling, incl. light/dark theme tokens and responsive rules
src/main.ts     Theme toggle, mobile nav toggle, footer year
public/         Static assets served as-is (favicon)
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
```

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

Everything in the Projects section is real. The "About & CV" and "Contact"
sections now contain real content (see `index.html`) — no placeholders
remain in the CV itself. Anything you want to change (photo, additional
projects, updated experience) is plain HTML in `index.html`, no build step
required beyond `npm run dev`.

## Deployment

Not deployed anywhere yet. This is a static site (output of `npm run
build` is a `dist/` folder of plain HTML/CSS/JS) so it can be hosted on
essentially anything that serves static files (e.g. Netlify, Vercel,
GitHub Pages, Cloudflare Pages, or the same home NAS as the flight tracker
project) — that's a deployment decision left for later.
