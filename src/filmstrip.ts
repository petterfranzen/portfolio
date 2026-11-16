/**
 * Act 4's filmstrip. On a wide screen the strip scrubs sideways as the section
 * is scrolled through. CSS does it where it can; this is the fallback and, on
 * every screen, the part that knows which tile sits under the centre line and
 * mounts a live preview when a visitor asks for one.
 */
import { $, $$, pinProgress, reduceMotion, supportsTimeline, wide } from "./dom.js";

const noop = () => {};

/** Moves the strip by hand where there is no view timeline to do it. */
function scrubber(section: HTMLElement | null, strip: HTMLElement | null): () => void {
  const cssScrubs = supportsTimeline && !reduceMotion.matches;
  if (cssScrubs || !wide.matches) return noop;
  if (!section || !strip) return noop;
  return () => {
    const travel = Math.max(strip.scrollWidth - window.innerWidth, 0);
    strip.style.transform = `translate3d(${(-travel * pinProgress(section)).toFixed(2)}px,0,0)`;
  };
}

/** Index of the on-screen tile nearest the centre line, or -1. */
function nearestToCentre(tiles: HTMLElement[]): number {
  const middle = window.innerWidth / 2;
  let best = -1;
  let bestDistance = Infinity;
  tiles.forEach((tile, index) => {
    const box = tile.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) return;
    const distance = Math.abs(box.left + box.width / 2 - middle);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/** The tile nearest the centre line gets the emphasis and a play button. */
function centreMarker(tiles: HTMLElement[]): () => void {
  let last = -1;
  return () => {
    const best = wide.matches ? nearestToCentre(tiles) : -1;
    if (best === last) return;
    last = best;
    tiles.forEach((tile, index) => tile.classList.toggle("is-centre", index === best));
  };
}

function stopPreview(tile: HTMLElement): void {
  const frame = $<HTMLIFrameElement>(".tile-preview iframe", tile);
  if (!frame) return;
  frame.remove();
  const play = $<HTMLButtonElement>(".tile-play", tile);
  if (play) play.hidden = false;
  tile.classList.remove("is-playing");
}

function previewFrame(tile: HTMLElement, url: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.loading = "lazy";
  frame.title = `${$(".tile-title", tile)?.textContent ?? "Night"} — live preview`;
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  return frame;
}

/* Preview iframes are only mounted when a visitor asks for one — no
   third-party request happens just from scrolling past. */
function wirePreview(tile: HTMLElement, tiles: HTMLElement[]): void {
  const play = $<HTMLButtonElement>(".tile-play", tile);
  const holder = $(".tile-preview", tile);
  const url = tile.dataset.url ?? "";
  if (!play || !holder) return;
  play.addEventListener("click", () => {
    const frame = previewFrame(tile, url);
    frame.addEventListener("load", () => play.remove());
    // One live preview at a time: stop whatever the previous tile was doing.
    for (const other of tiles) if (other !== tile) stopPreview(other);
    holder.append(frame);
    tile.classList.add("is-playing");
    play.hidden = true;
  });
}

/** Returns the per-frame update for the strip. */
export function initFilmstrip(): () => void {
  const tiles = $$(".tile");
  for (const tile of tiles) wirePreview(tile, tiles);
  const scrub = scrubber($(".act-nights"), $("#strip"));
  const mark = centreMarker(tiles);
  return () => {
    scrub();
    mark();
  };
}
