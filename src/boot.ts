/**
 * Act 1's boot sequence. The final name and pitch are already in the HTML, so
 * this is decoration only: the log lines reveal, the name decodes, the pitch
 * types. Reduced motion leaves the text as written.
 */
import { $, $$, clamp, reduceMotion } from "./dom.js";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/\\<>_+=*";
const DECODE_MS = 1050;
const LINE_MS = 160;

const glyph = () => GLYPHS[Math.trunc(Math.random() * GLYPHS.length)];

/** The name with everything from `revealed` on replaced by noise. */
const scrambled = (text: string, revealed: number) =>
  text.slice(0, revealed) + text.slice(revealed).replace(/\S/g, glyph);

/** The name resolves out of noise, left to right, then calls `done`. */
function decodeName(decode: HTMLElement, startAt: number, done: () => void): void {
  const finalName = decode.dataset.text ?? "";
  decode.dataset.decoding = "true";
  const tick = () => {
    const progress = clamp((performance.now() - startAt) / DECODE_MS, 0, 1);
    if (progress < 1) {
      decode.textContent = scrambled(finalName, Math.floor(progress * finalName.length));
      requestAnimationFrame(tick);
      return;
    }
    decode.textContent = finalName;
    delete decode.dataset.decoding;
    done();
  };
  requestAnimationFrame(tick);
}

/** The pitch types in, in small bursts so it never feels like a spinner. */
function typePitch(pitch: HTMLElement, pitchText: HTMLElement): void {
  const finalPitch = pitch.dataset.pitch ?? "";
  // Reveal the paragraph as it types; it was hidden only so the finished
  // text did not flash before the boot sequence got there.
  pitch.dataset.typed = "true";
  let cursor = 0;
  const step = () => {
    cursor = Math.min(finalPitch.length, cursor + 2);
    pitchText.textContent = finalPitch.slice(0, cursor);
    if (cursor < finalPitch.length) window.setTimeout(step, 14);
    else $(".caret", pitch)?.remove();
  };
  window.setTimeout(step, 180);
}

export function initBoot(): void {
  const lines = $$(".boot-line");
  lines.forEach((line, index) => line.style.setProperty("--i", String(index)));
  if (reduceMotion.matches) return;

  const decode = $(".decode");
  const pitchText = $("#pitch .pitch-text");
  const pitch = pitchText?.parentElement;
  if (!decode || !pitch) return;

  pitch.dataset.typed = "false";
  pitchText.textContent = "";
  const startAt = performance.now() + lines.length * LINE_MS + 350;
  decodeName(decode, startAt, () => typePitch(pitch, pitchText));
}
