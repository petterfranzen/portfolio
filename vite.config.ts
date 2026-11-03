import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

interface Night {
  date: string;
  slug: string;
  title: string;
  language: string;
  idea: string;
  url: string;
}

interface Crew {
  name: string;
  role: string;
  line: string;
}

const read = <T,>(file: string): T =>
  JSON.parse(readFileSync(path.resolve(file), "utf8")) as T;

const escape = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Bakes the build-time content into index.html.
 *
 * Everything that grows or changes without anyone editing this repo — the
 * nightly experiments list and the counts shown in acts 1 and 2 — is written
 * into the HTML here rather than fetched by the browser or typed in by hand.
 * The same plugin runs in dev and in the production build, so what you see
 * locally is what ships, and the page stays readable with JavaScript off.
 */
function section9Content(): Plugin {
  let crew: Crew[] = [];
  let nights: Night[] = [];

  const load = () => {
    crew = read<Crew[]>("content/crew.json");
    nights = read<{ experiments: Night[] }>("src/experiments.generated.json").experiments;
  };

  const bootLog = () =>
    [
      "> section9.boot",
      "> mount /crew ................ ok",
      `> agents online .............. ${crew.length}`,
      `> nightly queue .............. ${nights.length} nights`,
      "> live systems ............... 2",
      "> render ..................... petter.franzén",
    ]
      .map((line) => `<span class="boot-line">${escape(line)}</span>`)
      .join("");

  const stats = () =>
    [
      { value: String(crew.length), label: "agents on the team" },
      { value: String(nights.length), label: "nights shipped" },
      { value: String(nights.length), label: "experiments live" },
      { value: "2", label: "public systems" },
    ]
      .map(
        (stat) =>
          `<div class="stat"><dt>${escape(stat.label)}</dt><dd>${escape(stat.value)}</dd></div>`,
      )
      .join("");

  const tiles = () =>
    nights
      .map(
        (night, index) => `<li class="tile" data-index="${index}" data-url="${escape(night.url)}">
              <a class="tile-link" href="${escape(night.url)}" target="_blank" rel="noopener noreferrer">
                <span class="tile-top"><span class="tile-date">${escape(night.date)}</span><span class="tile-lang">${escape(night.language)}</span></span>
                <span class="tile-title">${escape(night.title)}</span>
                <span class="tile-idea">${escape(night.idea)}</span>
                <span class="tile-open">Open <span aria-hidden="true">↗</span><span class="sr-only"> ${escape(night.title)}</span></span>
              </a>
              <div class="tile-preview" data-preview>
                <button class="tile-play" type="button" aria-label="Play a live preview of ${escape(night.title)}">Play preview</button>
              </div>
            </li>`,
      )
      .join("\n            ");

  return {
    name: "section9-content",
    buildStart() {
      load();
    },
    transformIndexHtml(html) {
      return html
        .replace("<!--bootlog-->", bootLog())
        .replace("<!--stats-->", stats())
        .replace("<!--experiments-->", tiles())
        .replace(/<span id="strip-count">\d+<\/span>/, `<span id="strip-count">${nights.length}</span>`);
    },
  };
}

export default defineConfig({
  plugins: [section9Content()],
  build: {
    target: "es2022",
    cssTarget: "chrome111",
  },
});
