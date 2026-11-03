import "./style.css";
import { EXPERIMENTS } from "./experiments.generated.js";

const list = document.getElementById("experiments");
if (list) {
  list.innerHTML = EXPERIMENTS.slice(0, 6)
    .map((night) => {
      const a = document.createElement("a");
      a.href = night.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = night.title;
      a.title = `${night.language}: ${night.idea}`;
      const li = document.createElement("li");
      li.appendChild(a);
      return li.outerHTML;
    })
    .join("");
}

// Gentle pointer parallax on the background, off for reduced motion.
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const root = document.documentElement;
if (!reduce.matches) {
  let frame = 0;
  window.addEventListener(
    "pointermove",
    (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty("--px", String(event.clientX / window.innerWidth - 0.5));
        root.style.setProperty("--py", String(event.clientY / window.innerHeight - 0.5));
      });
    },
    { passive: true },
  );
}
