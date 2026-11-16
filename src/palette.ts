/**
 * Command palette. K or / opens it; a button does the same on touch. It lists
 * the five acts, the prose page and the public apps, filters as you type, and
 * drives the same view-transition jump as the rail.
 */
import { $, $$ } from "./dom.js";
import { EXPERIMENTS, EXPERIMENTS_INDEX } from "./experiments.js";
import { jumpToAct } from "./rail.js";

interface Destination {
  label: string;
  /** What the row says it will do: stay on the page, go to one, or open a tab. */
  kind: "Act" | "Go" | "Open ↗";
  href?: string;
  act?: string;
  index?: number;
}

const act = (index: number, label: string): Destination => ({
  label,
  kind: "Act",
  act: `act-${index}`,
  index,
});
const external = (label: string, href: string): Destination => ({ label, kind: "Open ↗", href });

const DESTINATIONS: Destination[] = [
  act(1, "Boot"),
  act(2, "Section 9"),
  act(3, "Flight Tracker"),
  act(4, "Nightly experiments"),
  act(5, "Sign-off"),
  { label: "How this was built — about the crew", kind: "Go", href: "/how-this-was-built/" },
  external("Flight Tracker — open the live app", "https://flight.pastabake.cloud"),
  external("Nightly experiments — all of them", EXPERIMENTS_INDEX),
  ...EXPERIMENTS.map((night) =>
    external(`${night.title} — ${night.language}, ${night.date}`, night.url),
  ),
];

const palette = $<HTMLDialogElement>("#palette");
const input = $<HTMLInputElement>("#palette-input");
const list = $<HTMLUListElement>("#palette-list");

let results: Destination[] = [];
let activeIndex = 0;

function go(destination: Destination | undefined): void {
  if (!destination) return;
  palette?.close();
  if (destination.act) jumpToAct(destination.act);
  else if (destination.kind === "Go" && destination.href) window.location.assign(destination.href);
  else if (destination.href) window.open(destination.href, "_blank", "noopener,noreferrer");
}

const span = (text: string, className = ""): HTMLSpanElement => {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
};

function row(destination: Destination, index: number): HTMLLIElement {
  const item = document.createElement("li");
  item.id = `palette-item-${index}`;
  item.className = "palette-item";
  item.setAttribute("role", "option");
  item.dataset.index = String(index);
  if (destination.index) {
    item.append(span(String(destination.index).padStart(2, "0"), "palette-num"));
  }
  item.append(span(destination.label), span(destination.kind, "palette-kind"));
  if (destination.kind === "Open ↗") {
    item.setAttribute("aria-label", `${destination.label} (opens in a new tab)`);
  }
  return item;
}

function emptyRow(): HTMLLIElement {
  const empty = document.createElement("li");
  empty.className = "palette-empty";
  empty.textContent = "Nothing here. Try an act, Flight Tracker or the nightly experiments.";
  return empty;
}

function select(index: number): void {
  if (results.length === 0) return;
  activeIndex = (index + results.length) % results.length;
  $$(".palette-item", list ?? document).forEach((item, itemIndex) => {
    const selected = itemIndex === activeIndex;
    item.setAttribute("aria-selected", String(selected));
    if (!selected) return;
    input?.setAttribute("aria-activedescendant", item.id);
    item.scrollIntoView({ block: "nearest" });
  });
}

function render(filter = ""): void {
  if (!list) return;
  const needle = filter.trim().toLowerCase();
  results = DESTINATIONS.filter((destination) => destination.label.toLowerCase().includes(needle));
  if (results.length === 0) {
    list.replaceChildren(emptyRow());
    input?.removeAttribute("aria-activedescendant");
    return;
  }
  list.replaceChildren(...results.map(row));
  select(0);
}

function open(): void {
  if (!palette) return;
  render();
  if (input) input.value = "";
  if (!palette.open) palette.showModal();
  requestAnimationFrame(() => input?.focus());
}

/** The row a pointer event landed on, as an index into `results`, or -1. */
function indexAt(event: Event): number {
  const item = (event.target as Element).closest<HTMLElement>(".palette-item");
  return item ? Number(item.dataset.index) : -1;
}

const KEYS: Record<string, () => void> = {
  ArrowDown: () => select(activeIndex + 1),
  ArrowUp: () => select(activeIndex - 1),
  Enter: () => go(results[activeIndex]),
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const isShortcut = (event: KeyboardEvent) =>
  ["k", "K", "/"].includes(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey;

function wireList(): void {
  list?.addEventListener("click", (event) => go(results[indexAt(event)]));
  list?.addEventListener("pointermove", (event) => {
    const index = indexAt(event);
    if (index >= 0 && index !== activeIndex) select(index);
  });
}

function wireInput(): void {
  input?.addEventListener("input", () => render(input.value));
  input?.addEventListener("keydown", (event) => {
    const action = KEYS[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });
}

export function initPalette(): void {
  $("#palette-open")?.addEventListener("click", open);
  wireInput();
  wireList();
  // A click on the backdrop closes; clicks inside the form do not.
  palette?.addEventListener("click", (event) => {
    if (event.target === palette) palette.close();
  });
  document.addEventListener("keydown", (event) => {
    if (isTyping(event.target) || !isShortcut(event)) return;
    event.preventDefault();
    if (palette?.open) palette.close();
    else open();
  });
}
