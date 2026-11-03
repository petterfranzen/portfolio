/**
 * The nightly experiments: apps from ghost-in-the-machine, one per night.
 *
 * The list is generated at build time (scripts/build-experiments.mjs) and
 * imported as data, so nothing is fetched from GitHub at runtime — the tiles
 * ship with the bundle and cost no requests. Each tile then loads a live
 * preview from GitHub Pages, lazily, and only once it's near the viewport.
 */

import {
  CREW_URL,
  EXPERIMENTS,
  EXPERIMENTS_INDEX,
  type Experiment,
} from "./experiments.generated.js";

/** Enough to show the idea without turning the section into an archive. */
const MAX_TILES = 6;

/** Night titles and ideas come from the repo as text, so they're escaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function item(night: Experiment): string {
  const url = escapeHtml(night.url);
  // The link is the title, stretched over the whole card with ::after. That
  // keeps the preview iframe out of the anchor — an iframe is interactive
  // content and doesn't belong inside a link.
  return `
    <li class="experiment">
      <div class="tile">
        <span class="tile-preview" data-preview="${url}"></span>
        <span class="tile-meta">
          <span class="tile-title">
            <a class="tile-link" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(night.title)}</a>
          </span>
          <span class="tile-idea">${escapeHtml(night.idea)}</span>
          <span class="tile-meta-foot">${escapeHtml(night.language)} · <time datetime="${escapeHtml(night.date)}">${escapeHtml(night.date)}</time></span>
        </span>
      </div>
    </li>`;
}

/**
 * Swaps each placeholder for an iframe of the published page, a little before
 * it scrolls into view. The iframe is inert (pointer-events: none) so it can't
 * swallow a phone scroll — the tile itself is the link.
 */
function setupPreviews(root: HTMLElement): void {
  const previews = Array.from(
    root.querySelectorAll<HTMLElement>("[data-preview]"),
  );
  if (previews.length === 0) return;

  const load = (preview: HTMLElement) => {
    const src = preview.dataset.preview;
    if (!src || preview.querySelector("iframe")) return;

    const frame = document.createElement("iframe");
    frame.src = src;
    frame.loading = "lazy";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("scrolling", "no");
    frame.title = "";
    preview.append(frame);
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Nothing to animate, but the previews still have to load.
    previews.forEach(load);
    return;
  }

  if (!("IntersectionObserver" in window)) {
    previews.forEach(load);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        load(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "600px 0px" },
  );

  previews.forEach((preview) => observer.observe(preview));
}

export function setupExperiments(): void {
  const container = document.getElementById("experiments-list");
  if (!container) return;

  if (EXPERIMENTS.length === 0) {
    container.innerHTML = `<p class="experiments-fallback">The nightly builds are published in <a href="${EXPERIMENTS_INDEX}" target="_blank" rel="noopener noreferrer">ghost-in-the-machine</a>.</p>`;
    return;
  }

  const shown = EXPERIMENTS.slice(0, MAX_TILES);

  container.innerHTML = `
    <ul class="experiments-grid">
      ${shown.map(item).join("")}
    </ul>
    <p class="experiments-more">
      <a href="${EXPERIMENTS_INDEX}" target="_blank" rel="noopener noreferrer">Every night so far</a>
      · <a href="${CREW_URL}" target="_blank" rel="noopener noreferrer">the crew behind them</a>
    </p>`;

  setupPreviews(container);
}
