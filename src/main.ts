import "./style.css";
import { initFlightArcs } from "./flight.js";
import { EXPERIMENTS, EXPERIMENTS_INDEX } from "./experiments.js";

const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(selector));

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/* --------------------------------------------------------------------------
   View transitions. Everything that swaps the page in place — the theme, a
   jump between acts — goes through here, and degrades to an instant change
   where the API or the visitor's motion preference says no.
   -------------------------------------------------------------------------- */

function withTransition(className: string, update: () => void): void {
  if (typeof document.startViewTransition !== "function" || reduceMotion.matches) {
    update();
    return;
  }
  // The callback must run exactly once: some browsers decline or abort a
  // transition (a hidden document, one already in flight), and a skipped
  // callback would mean the theme simply doesn't change. So run it up front
  // and let the transition snapshot the result, with a timer as a last resort.
  let applied = false;
  const run = () => {
    if (applied) return;
    applied = true;
    update();
  };
  const clean = () => root.classList.remove(className);
  root.classList.add(className);
  try {
    const transition = document.startViewTransition(run);
    transition.finished.then(clean, clean);
  } catch {
    run();
    clean();
  }
  window.setTimeout(run, 350);
  window.setTimeout(clean, 1000);
}

/* --------------------------------------------------------------------------
   Theme. The saved choice wins; otherwise the OS preference decides. Both
   toggles in the page drive the same state.
   -------------------------------------------------------------------------- */

const themeButtons = $$<HTMLButtonElement>("#theme-toggle, #theme-toggle-2");

function paintTheme(): void {
  const light = root.dataset.theme === "light";
  for (const button of themeButtons) {
    const label = light ? "Switch to dark theme" : "Switch to light theme";
    if (button.id === "theme-toggle") {
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(light));
    } else {
      button.textContent = light ? "Dark theme" : "Light theme";
      button.setAttribute("aria-label", label);
    }
  }
  const meta = $<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = light ? "#edf2ef" : "#04070a";
}

function toggleTheme(): void {
  const next = root.dataset.theme === "light" ? "dark" : "light";
  withTransition("theme-swapping", () => {
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode: the choice just doesn't persist */
    }
  });
  paintTheme();
}

for (const button of themeButtons) button.addEventListener("click", toggleTheme);
paintTheme();

/* --------------------------------------------------------------------------
   Atmosphere: pointer depth on a fine pointer, nothing on touch. Two custom
   properties drive the fixed grid and glow layers; the scroll-driven depth
   on phones is all in the CSS.
   -------------------------------------------------------------------------- */

if (finePointer.matches && !reduceMotion.matches) {
  let frame = 0;
  let targetX = 0;
  let targetY = 0;
  window.addEventListener(
    "pointermove",
    (event) => {
      targetX = event.clientX / window.innerWidth - 0.5;
      targetY = event.clientY / window.innerHeight - 0.5;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty("--mx", targetX.toFixed(3));
        root.style.setProperty("--my", targetY.toFixed(3));
      });
    },
    { passive: true },
  );
}

/* --------------------------------------------------------------------------
   Boot sequence. The final name and pitch are already in the HTML, so this is
   decoration only: the log lines reveal, the name decodes, the pitch types.
   Reduced motion (or a browser without the APIs) leaves the text as written.
   -------------------------------------------------------------------------- */

const bootLog = $("#boot-log");
if (bootLog) {
  $$(".boot-line", bootLog).forEach((line, index) =>
    line.style.setProperty("--i", String(index)),
  );
}

function runBoot(): void {
  if (reduceMotion.matches) return;

  const decode = $<HTMLElement>(".decode");
  const pitch = $<HTMLElement>("#pitch");
  const pitchText = pitch ? $<HTMLElement>(".pitch-text", pitch) : null;
  const finalName = decode?.dataset.text ?? "";
  const finalPitch = pitch?.dataset.pitch ?? "";

  if (pitch) pitch.dataset.typed = "false";
  if (pitchText) pitchText.textContent = "";
  if (decode) decode.dataset.decoding = "true";

  const lines = $$(".boot-line", bootLog ?? document).length;
  const lineDelay = lines * 160 + 350;

  // 1. The name resolves out of noise, left to right.
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/\\<>_+=*";
  const decodeStart = performance.now() + lineDelay;
  const decodeDuration = 1050;
  const decodeTick = () => {
    const now = performance.now();
    const progress = clamp((now - decodeStart) / decodeDuration, 0, 1);
    if (!decode) return;
    if (now < decodeStart) {
      decode.textContent = finalName.replace(/[^\s]/g, () => glyphs[(Math.random() * glyphs.length) | 0]);
      requestAnimationFrame(decodeTick);
      return;
    }
    const revealed = Math.floor(progress * finalName.length);
    decode.textContent =
      finalName.slice(0, revealed) +
      finalName
        .slice(revealed)
        .split("")
        .map((char) => (char === " " ? " " : glyphs[(Math.random() * glyphs.length) | 0]))
        .join("");
    if (progress < 1) {
      requestAnimationFrame(decodeTick);
    } else {
      decode.textContent = finalName;
      delete decode.dataset.decoding;
      typePitch();
    }
  };

  // 2. The pitch types in, in small bursts so it never feels like a spinner.
  function typePitch(): void {
    if (!pitchText || !pitch) return;
    let cursor = 0;
    const step = () => {
      cursor = Math.min(finalPitch.length, cursor + 2);
      pitchText.textContent = finalPitch.slice(0, cursor);
      if (cursor < finalPitch.length) {
        window.setTimeout(step, 14);
      } else {
        pitch.dataset.typed = "true";
        const caret = $(".caret", pitch);
        if (caret) caret.remove();
      }
    };
    window.setTimeout(step, 180);
  }

  requestAnimationFrame(decodeTick);
}

runBoot();

/* --------------------------------------------------------------------------
   Rail: active act and scroll progress. One IntersectionObserver marks the act
   in view; a passive scroll listener fills the line. Both are cheap and only
   run while the page is visible.
   -------------------------------------------------------------------------- */

const acts = $$<HTMLElement>(".act");
const railLinks = $$<HTMLAnchorElement>("[data-act-link]");
const railFill = $<HTMLElement>(".rail-fill");

let scrollQueued = false;
const onScroll = () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    root.style.setProperty("--scroll", progress.toFixed(4));
    if (railFill) railFill.style.transform = `scaleY(${progress})`;
    fallbackPipeline();
    fallbackStrip();
    updateCentreTile();
  });
};
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);

const setActiveAct = (id: string) => {
  for (const link of railLinks) {
    if (link.dataset.actLink && `act-${link.dataset.actLink}` === id) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  }
};

if ("IntersectionObserver" in window && acts.length > 0) {
  const visible = new Map<string, number>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
      let bestId = "";
      let bestRatio = 0;
      for (const [id, ratio] of visible) {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      }
      if (bestId) setActiveAct(bestId);
    },
    { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 1] },
  );
  for (const act of acts) observer.observe(act);
}

/* --------------------------------------------------------------------------
   Pipeline. CSS drives the progress line with a view timeline where it can.
   Where it cannot — or under reduced motion, where the section is stacked —
   this scroll handler lights the stages and keeps the line in step.
   -------------------------------------------------------------------------- */

const model = $<HTMLElement>("#act-2");
const stages = $$<HTMLElement>(".stage", model ?? document);
const supportsTimeline =
  typeof CSS !== "undefined" && CSS.supports("animation-timeline", "view()");
const pipelineNeedsJs = !supportsTimeline || reduceMotion.matches;

function fallbackPipeline(): void {
  if (!pipelineNeedsJs || !model || stages.length === 0) return;
  const rect = model.getBoundingClientRect();
  const viewport = window.innerHeight;
  // 0 when the section's top reaches the top of the viewport, 1 when its
  // bottom reaches the bottom — the same span the CSS timeline would use.
  const span = Math.max(rect.height - viewport, 1);
  const progress = clamp(-rect.top / span, 0, 1);
  const pin = $<HTMLElement>(".pin", model);
  if (pin) pin.style.setProperty("--p", progress.toFixed(4));
  if (reduceMotion.matches) {
    for (const stage of stages) stage.classList.add("is-live");
    return;
  }
  const active = Math.min(stages.length - 1, Math.floor(progress * stages.length * 0.999));
  stages.forEach((stage, index) => {
    stage.classList.toggle("is-done", index < active);
    stage.classList.toggle("is-live", index === active && progress > 0.02);
  });
}

/* --------------------------------------------------------------------------
   Filmstrip. On a wide screen the strip scrubs sideways as the section is
   scrolled through. CSS does it where it can; this is the fallback and, on
   every screen, the part that knows which tile sits under the centre line.
   -------------------------------------------------------------------------- */

const nights = $<HTMLElement>("#act-4");
const strip = $<HTMLElement>("#strip");
const track = $<HTMLElement>("#strip-track");
const tiles = $$<HTMLElement>(".tile", track ?? document);
const stripViewport = $<HTMLElement>("#strip-viewport");

const wide = window.matchMedia("(min-width: 901px)");
const stripNeedsJs = (!supportsTimeline || reduceMotion.matches) && wide.matches;

function fallbackStrip(): void {
  if (!stripNeedsJs || !nights || !strip || !track) return;
  const rect = nights.getBoundingClientRect();
  const span = Math.max(rect.height - window.innerHeight, 1);
  const progress = clamp(-rect.top / span, 0, 1);
  const travel = Math.max(track.scrollWidth - window.innerWidth, 0);
  strip.style.transform = `translate3d(${(-travel * progress).toFixed(2)}px,0,0)`;
}

/** The tile nearest the centre line gets the emphasis and a play button. */
let lastCentre = -1;
function updateCentreTile(): void {
  if (!wide.matches || tiles.length === 0 || !stripViewport) {
    for (const tile of tiles) tile.classList.remove("is-centre");
    lastCentre = -1;
    return;
  }
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
  if (best === lastCentre) return;
  lastCentre = best;
  tiles.forEach((tile, index) => tile.classList.toggle("is-centre", index === best));
}

/* Preview iframes are only mounted when a visitor asks for one — no
   third-party request happens just from scrolling past. */
for (const tile of tiles) {
  const play = $<HTMLButtonElement>(".tile-play", tile);
  const holder = $<HTMLElement>(".tile-preview", tile);
  if (!play || !holder) continue;
  play.addEventListener("click", () => {
    const url = tile.dataset.url;
    if (!url) return;
    const frame = document.createElement("iframe");
    frame.src = url;
    frame.loading = "lazy";
    frame.title = `${$(".tile-title", tile)?.textContent ?? "Night"} — live preview`;
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    frame.addEventListener("load", () => play.remove());
    // One live preview at a time: stop whatever the previous tile was doing.
    for (const other of tiles) {
      if (other === tile) continue;
      const otherHolder = $<HTMLElement>(".tile-preview", other);
      if (otherHolder?.querySelector("iframe")) {
        otherHolder.querySelector("iframe")?.remove();
        const otherPlay = $<HTMLButtonElement>(".tile-play", other);
        if (otherPlay) otherPlay.hidden = false;
        other.classList.remove("is-playing");
      }
    }
    holder.append(frame);
    tile.classList.add("is-playing");
    play.hidden = true;
  });
}

/* --------------------------------------------------------------------------
   Command palette. K or / opens it; a button does the same on touch. It lists
   the five acts and the public apps, filters as you type, and drives the same
   view-transition jump as the rail.
   -------------------------------------------------------------------------- */

interface Destination {
  label: string;
  kind: "Act" | "App" | "Nightly";
  href?: string;
  act?: string;
  external?: boolean;
  index?: number;
}

const destinations: Destination[] = [
  { label: "Boot", kind: "Act", act: "act-1", index: 1 },
  { label: "Operating model", kind: "Act", act: "act-2", index: 2 },
  { label: "Flight Tracker", kind: "Act", act: "act-3", index: 3 },
  { label: "Nightly experiments", kind: "Act", act: "act-4", index: 4 },
  { label: "Sign-off", kind: "Act", act: "act-5", index: 5 },
  { label: "Flight Tracker — open the live app", kind: "App", href: "https://flight.pastabake.cloud", external: true },
  { label: "Nightly experiments — all of them", kind: "App", href: EXPERIMENTS_INDEX, external: true },
  ...EXPERIMENTS.map((night) => ({
    label: `${night.title} — ${night.language}, ${night.date}`,
    kind: "Nightly" as const,
    href: night.url,
    external: true,
  })),
];

const palette = $<HTMLDialogElement>("#palette");
const paletteInput = $<HTMLInputElement>("#palette-input");
const paletteList = $<HTMLUListElement>("#palette-list");
const paletteOpen = $<HTMLButtonElement>("#palette-open");

let results: Destination[] = [];
let activeIndex = 0;

const jumpToAct = (id: string) => {
  const target = document.getElementById(id);
  if (!target) return;
  withTransition("act-jumping", () => {
    target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
  });
  setActiveAct(id);
  try {
    history.replaceState(null, "", `#${id}`);
  } catch {
    /* file:// or a locked-down history: the scroll still happened */
  }
};

const openExternal = (href: string) => {
  window.open(href, "_blank", "noopener,noreferrer");
};

const go = (destination: Destination) => {
  palette?.close();
  if (destination.act) {
    jumpToAct(destination.act);
  } else if (destination.href) {
    openExternal(destination.href);
  }
};

function renderPalette(filter = ""): void {
  if (!paletteList) return;
  const needle = filter.trim().toLowerCase();
  results = destinations.filter((destination) => destination.label.toLowerCase().includes(needle));
  activeIndex = 0;
  paletteList.replaceChildren();

  if (results.length === 0) {
    const empty = document.createElement("li");
    empty.className = "palette-empty";
    empty.textContent = "Nothing here. Try an act, Flight Tracker or the nightly experiments.";
    paletteList.append(empty);
    paletteInput?.removeAttribute("aria-activedescendant");
    return;
  }

  results.forEach((destination, index) => {
    const item = document.createElement("li");
    item.id = `palette-item-${index}`;
    item.className = "palette-item";
    item.setAttribute("role", "option");
    item.dataset.index = String(index);

    if (destination.index) {
      const num = document.createElement("span");
      num.className = "palette-num";
      num.textContent = String(destination.index).padStart(2, "0");
      item.append(num);
    }

    const label = document.createElement("span");
    label.textContent = destination.label;
    item.append(label);

    const kind = document.createElement("span");
    kind.className = "palette-kind";
    kind.textContent = destination.kind === "Act" ? "Act" : "Open ↗";
    item.append(kind);

    if (destination.external) {
      item.setAttribute("aria-label", `${destination.label} (opens in a new tab)`);
    }
    paletteList.append(item);
  });
  selectPaletteItem(0);
}

function selectPaletteItem(index: number): void {
  if (results.length === 0) return;
  activeIndex = (index + results.length) % results.length;
  const items = $$(".palette-item", paletteList ?? document);
  items.forEach((item, itemIndex) => {
    const selected = itemIndex === activeIndex;
    item.setAttribute("aria-selected", String(selected));
    if (selected) {
      paletteInput?.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    }
  });
}

function openPalette(): void {
  if (!palette) return;
  renderPalette();
  if (paletteInput) paletteInput.value = "";
  if (!palette.open) palette.showModal();
  requestAnimationFrame(() => paletteInput?.focus());
}

paletteOpen?.addEventListener("click", openPalette);

paletteInput?.addEventListener("input", () => renderPalette(paletteInput.value));

paletteInput?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectPaletteItem(activeIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    selectPaletteItem(activeIndex - 1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const destination = results[activeIndex];
    if (destination) go(destination);
  }
});

paletteList?.addEventListener("click", (event) => {
  const item = (event.target as Element).closest<HTMLElement>(".palette-item");
  if (!item) return;
  const destination = results[Number(item.dataset.index)];
  if (destination) go(destination);
});

paletteList?.addEventListener("pointermove", (event) => {
  const item = (event.target as Element).closest<HTMLElement>(".palette-item");
  if (!item) return;
  const index = Number(item.dataset.index);
  if (Number.isFinite(index) && index !== activeIndex) selectPaletteItem(index);
});

palette?.addEventListener("click", (event) => {
  // A click on the backdrop closes; clicks inside the form do not.
  if (event.target === palette) palette.close();
});

document.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable;
  if (typing) return;

  if ((event.key === "k" || event.key === "K" || event.key === "/") && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    if (palette?.open) palette.close();
    else openPalette();
  }
});

/* Rail and in-page links: route through the view transition when possible. */
for (const link of $$<HTMLAnchorElement>('a[href^="#"]')) {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href") ?? "";
    const id = href.slice(1);
    if (!id || !document.getElementById(id)) return;
    event.preventDefault();
    jumpToAct(id);
  });
}

/* Keep the active act honest when the visitor arrives on a hash. */
if (location.hash.length > 1) {
  const id = location.hash.slice(1);
  if (document.getElementById(id)) requestAnimationFrame(() => setActiveAct(id));
}

/* The rail's own links need to be in the tab order only when visible. */
if (window.matchMedia("(max-width: 900px)").matches) {
  const rail = $<HTMLElement>(".rail");
  if (rail) rail.setAttribute("aria-hidden", "true");
}

/* Act 3's backdrop. */
const arcs = $<HTMLCanvasElement>("#arcs");
if (arcs) initFlightArcs(arcs);

onScroll();
window.addEventListener("load", onScroll);

/* A readiness flag for tests and for anything that needs to know the
   interaction layer is live (the boot sequence still runs after this). */
root.dataset.ready = "true";
