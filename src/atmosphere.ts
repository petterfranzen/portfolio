/**
 * Atmosphere: pointer depth on a fine pointer, nothing on touch. Two custom
 * properties drive the fixed grid and glow layers; the scroll-driven depth on
 * phones is all in the CSS.
 */
import { finePointer, reduceMotion, root } from "./dom.js";

export function initAtmosphere(): void {
  if (!finePointer.matches || reduceMotion.matches) return;
  let frame = 0;
  let targetX = 0;
  let targetY = 0;
  const paint = () => {
    frame = 0;
    root.style.setProperty("--mx", targetX.toFixed(3));
    root.style.setProperty("--my", targetY.toFixed(3));
  };
  window.addEventListener(
    "pointermove",
    (event) => {
      targetX = event.clientX / window.innerWidth - 0.5;
      targetY = event.clientY / window.innerHeight - 0.5;
      if (!frame) frame = requestAnimationFrame(paint);
    },
    { passive: true },
  );
}
