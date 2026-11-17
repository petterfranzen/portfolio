/**
 * The rail: which act is current, how far the page has scrolled, and the jump
 * every in-page link and the palette go through. One IntersectionObserver
 * marks the act in view; one passive scroll listener fills the line and runs
 * whatever the pinned acts need on the same frame.
 */
import { $, $$, clamp, reduceMotion, root } from "./dom.js";
import { withTransition } from "./theme.js";

const railLinks = $$<HTMLAnchorElement>("[data-act-link]");

export function setActiveAct(id: string): void {
  for (const link of railLinks) {
    if (`act-${link.dataset.actLink}` === id) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
}

export function jumpToAct(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  // Inside a view transition the jump must be instant: the transition is the
  // animation, and a smooth scroll would start after the new snapshot was
  // taken, so the fade would show the old position. Without the API, scroll
  // smoothly instead.
  const useTransition =
    typeof document.startViewTransition === "function" && !reduceMotion.matches;
  withTransition("act-jumping", () => {
    target.scrollIntoView({ behavior: useTransition ? "instant" : "smooth", block: "start" });
  });
  setActiveAct(id);
  try {
    history.replaceState(null, "", `#${id}`);
  } catch {
    /* file:// or a locked-down history: the scroll still happened */
  }
}

/** The act with the most of itself inside the middle band of the viewport. */
function observeActs(acts: HTMLElement[]): void {
  if (!("IntersectionObserver" in window) || acts.length === 0) return;
  const visible = new Map<string, number>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
      const [bestId, bestRatio] = [...visible].reduce((best, next) => (next[1] > best[1] ? next : best));
      if (bestRatio > 0) setActiveAct(bestId);
    },
    { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 1] },
  );
  for (const act of acts) observer.observe(act);
}

/** Rail and in-page links: route through the view transition when possible. */
function wireHashLinks(): void {
  for (const link of $$<HTMLAnchorElement>('a[href^="#"]')) {
    link.addEventListener("click", (event) => {
      const id = (link.getAttribute("href") ?? "").slice(1);
      if (!id || !document.getElementById(id)) return;
      event.preventDefault();
      jumpToAct(id);
    });
  }
}

/**
 * Starts the rail and returns the frame callback, so the caller can run it
 * once more on load. `onFrame` runs at most once per animation frame.
 */
export function initRail(onFrame: () => void): () => void {
  const railFill = $(".rail-fill");
  let queued = false;
  const paint = () => {
    queued = false;
    const max = root.scrollHeight - window.innerHeight;
    const progress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    root.style.setProperty("--scroll", progress.toFixed(4));
    if (railFill) railFill.style.transform = `scaleY(${progress})`;
    onFrame();
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paint);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  observeActs($$(".act"));
  wireHashLinks();

  /* Keep the active act honest when the visitor arrives on a hash. */
  const hash = location.hash.slice(1);
  if (hash && document.getElementById(hash)) requestAnimationFrame(() => setActiveAct(hash));

  /* The rail's own links need to be in the tab order only when visible. */
  if (window.matchMedia("(max-width: 900px)").matches) {
    $(".rail")?.setAttribute("aria-hidden", "true");
  }
  return onScroll;
}
