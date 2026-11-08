/**
 * Theme, and the view transition that everything swapping the page in place
 * goes through.
 *
 * Shared by the five-act page (src/main.ts) and the plain prose page
 * (src/page.ts) so that both read the same saved choice and write it back the
 * same way. The saved value wins; otherwise the OS preference decides — the
 * inline script in each page's head applies it before first paint.
 */

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * An act jump or a theme swap. The callback must run exactly once: some
 * browsers decline or abort a transition (a hidden document, one already in
 * flight), and a skipped callback would mean the change simply doesn't
 * happen. So run it up front and let the transition snapshot the result, with
 * a timer as a last resort.
 */
export function withTransition(className: string, update: () => void): void {
  if (typeof document.startViewTransition !== "function" || reduceMotion.matches) {
    update();
    return;
  }
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

const themeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("#theme-toggle, #theme-toggle-2"),
);

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
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
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

/** Wires every theme control on the page and paints the state it starts in. */
export function initTheme(): void {
  for (const button of themeButtons) button.addEventListener("click", toggleTheme);
  paintTheme();
}
