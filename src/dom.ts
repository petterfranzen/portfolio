/**
 * The few DOM helpers and media queries every part of the five-act page
 * shares. No behaviour lives here: each act's module owns its own.
 */

export const $ = <T extends Element = HTMLElement>(selector: string, parent: ParentNode = document) =>
  parent.querySelector<T>(selector);

export const $$ = <T extends Element = HTMLElement>(selector: string, parent: ParentNode = document) =>
  Array.from(parent.querySelectorAll<T>(selector));

export const root = document.documentElement;
export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
export const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
export const wide = window.matchMedia("(min-width: 901px)");

/** Whether CSS can drive the pinned acts on its own (animation-timeline). */
export const supportsTimeline =
  typeof CSS !== "undefined" && CSS.supports("animation-timeline", "view()");

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * How far a tall, pinned section has been scrolled through: 0 when its top
 * reaches the top of the viewport, 1 when its bottom reaches the bottom — the
 * same span the CSS view timeline uses.
 */
export function pinProgress(section: HTMLElement): number {
  const rect = section.getBoundingClientRect();
  const span = Math.max(rect.height - window.innerHeight, 1);
  return clamp(-rect.top / span, 0, 1);
}
