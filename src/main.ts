import "./style.css";
import { setupExperiments } from "./experiments.js";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "portfolio-theme";
const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

function applyTheme(theme: Theme) {
  root.setAttribute("data-theme", theme);
  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    const next = theme === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-label", `Switch to ${next} theme`);
    toggle.setAttribute("aria-pressed", String(theme === "light"));
  }
}

function initTheme() {
  // Dark is the house default; the toggle is the only way to light.
  applyTheme(getStoredTheme() ?? "dark");
}

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next: Theme = current === "dark" ? "light" : "dark";
    const commit = () => {
      applyTheme(next);
      localStorage.setItem(THEME_STORAGE_KEY, next);
    };

    // A cross-fade between the two themes where the browser supports it.
    // Everything else — including reduced motion — just switches.
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (doc.startViewTransition && !reduceMotion.matches) {
      doc.startViewTransition(commit);
    } else {
      commit();
    }
  });
}

function setupNavToggle() {
  const navToggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!navToggle || !nav) return;

  const close = () => {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open menu");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", close);
  });

  // Escape closes the disclosure and returns focus to its trigger, which is
  // what a keyboard user expects from a menu button.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      close();
      navToggle.focus();
    }
  });
}

function setupFooterYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

/**
 * Reveals on scroll. The hidden state lives behind the `js` class, so with
 * scripting off — or if this never runs — the content is simply there.
 */
function setupReveals() {
  const targets = document.querySelectorAll<HTMLElement>(".reveal");
  if (targets.length === 0) return;

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
  );

  targets.forEach((el) => observer.observe(el));
}

/**
 * Parallax fallback for browsers without scroll-driven animations. Where
 * `animation-timeline: scroll()` works the CSS does it on the compositor and
 * this does nothing at all.
 */
function setupParallaxFallback() {
  if (reduceMotion.matches) return;
  if (CSS.supports("animation-timeline: scroll()")) return;

  const layers = Array.from(
    document.querySelectorAll<HTMLElement>(".hero-layer"),
  );
  if (layers.length === 0) return;

  let queued = false;
  const update = () => {
    queued = false;
    const y = window.scrollY;
    if (y > window.innerHeight * 1.2) return;
    layers.forEach((layer) => {
      const depth = Number(layer.style.getPropertyValue("--depth")) || 0.3;
      layer.style.transform = `translate3d(0, ${y * depth * 0.26}px, 0)`;
    });
  };

  window.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}

/** A soft light that follows the cursor across the apps section. */
function setupSpotlight() {
  const section = document.querySelector<HTMLElement>(".apps");
  if (!section) return;
  if (reduceMotion.matches) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  section.addEventListener("pointermove", (event) => {
    const rect = section.getBoundingClientRect();
    section.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    section.style.setProperty("--my", `${event.clientY - rect.top}px`);
    section.classList.add("is-lit");
  });

  section.addEventListener("pointerleave", () => {
    section.classList.remove("is-lit");
  });
}

function setupHeaderState() {
  const header = document.querySelector<HTMLElement>(".site-header");
  if (!header) return;

  const update = () => {
    header.classList.toggle("is-stuck", window.scrollY > 8);
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

initTheme();
setupThemeToggle();
setupNavToggle();
setupFooterYear();
setupReveals();
setupParallaxFallback();
setupSpotlight();
setupHeaderState();
setupExperiments();
