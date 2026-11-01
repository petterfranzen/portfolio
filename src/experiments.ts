/**
 * The Experiments section: the nightly apps from ghost-in-the-machine.
 *
 * The list is generated at build time (scripts/build-experiments.mjs) and
 * imported as data, so nothing is fetched from GitHub at runtime — the section
 * ships with the bundle and costs no requests. Same reasoning as the Lab:
 * vanilla TypeScript, a short render, no framework.
 */

import {
  CREW_URL,
  EXPERIMENTS,
  EXPERIMENTS_INDEX,
  type Experiment,
} from "./experiments.generated.js";

/** Night titles and ideas come from the repo as text, so they're escaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function item(night: Experiment): string {
  return `
    <li class="experiment">
      <a class="experiment-link" href="${escapeHtml(night.url)}" target="_blank" rel="noopener noreferrer">
        <time class="experiment-date" datetime="${escapeHtml(night.date)}">${escapeHtml(night.date)}</time>
        <span class="experiment-body">
          <span class="experiment-head">
            <span class="experiment-title">${escapeHtml(night.title)}</span>
            <span class="experiment-language">${escapeHtml(night.language)}</span>
          </span>
          <span class="experiment-idea">${escapeHtml(night.idea)}</span>
        </span>
      </a>
    </li>`;
}

export function setupExperiments(): void {
  const container = document.getElementById("experiments-list");
  if (!container) return;

  if (EXPERIMENTS.length === 0) {
    container.innerHTML = `<p class="experiments-fallback">The nightly builds are published in <a href="${EXPERIMENTS_INDEX}" target="_blank" rel="noopener noreferrer">ghost-in-the-machine</a>.</p>`;
    return;
  }

  container.innerHTML = `
    <ul class="experiments-list">
      ${EXPERIMENTS.map(item).join("")}
    </ul>
    <p class="experiments-more">
      Everything is public:
      <a href="${EXPERIMENTS_INDEX}" target="_blank" rel="noopener noreferrer">the whole run so far</a>
      and <a href="${CREW_URL}" target="_blank" rel="noopener noreferrer">the crew behind it</a>:
      five agents on Section 9 callsigns and all.
    </p>`;
}
