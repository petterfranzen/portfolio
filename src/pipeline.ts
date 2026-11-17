/**
 * Act 2's loop. CSS drives the progress line and lights the stages with a
 * view timeline where it can. Where it cannot — or under reduced motion, where
 * the section is stacked — this lights the stages and keeps the line in step.
 */
import { $, $$, pinProgress, reduceMotion, supportsTimeline } from "./dom.js";

const noop = () => {};

function lightStages(stages: HTMLElement[], progress: number): void {
  const active = Math.min(stages.length - 1, Math.floor(progress * stages.length * 0.999));
  stages.forEach((stage, index) => {
    stage.classList.toggle("is-done", index < active);
    stage.classList.toggle("is-live", index === active && progress > 0.02);
  });
}

/** Returns the per-frame update, or a no-op where CSS already does the work. */
export function initPipeline(): () => void {
  const model = $(".act-model");
  const stages = $$(".stage", model ?? document);
  const cssLights = supportsTimeline && !reduceMotion.matches;
  if (cssLights || !model) return noop;

  if (reduceMotion.matches) {
    // Stacked and simply lit: nothing to scrub.
    for (const stage of stages) stage.classList.add("is-live");
    return noop;
  }
  const pin = $(".pin", model);
  return () => {
    const progress = pinProgress(model);
    pin?.style.setProperty("--p", progress.toFixed(4));
    lightStages(stages, progress);
  };
}
