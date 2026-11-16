import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

type Standing = "liked" | "reviewed" | "pending";

interface Night {
  date: string;
  slug: string;
  title: string;
  language: string;
  idea: string;
  verdict: string;
  standing: Standing;
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

const STANDING_LABEL: Record<Standing, string> = {
  liked: "Liked",
  reviewed: "Reviewed",
  pending: "Awaiting review",
};

/** How many nights are featured under the strip. */
const STANDOUTS = 4;
/** A verdict is quoted up to about this many characters, whole sentences only. */
const VERDICT_CHARS = 150;

/** The opening sentence(s) of a verdict: always the first, more while they fit. */
function brief(verdict: string): string {
  const [first = "", ...rest] = verdict.split(/(?<=\.)\s+/);
  let text = first;
  for (const sentence of rest) {
    if (text.length + sentence.length >= VERDICT_CHARS) break;
    text += ` ${sentence}`;
  }
  return text;
}

const count = (nights: Night[], standing: Standing) =>
  nights.filter((night) => night.standing === standing).length;

const languages = (nights: Night[]) => new Set(nights.map((night) => night.language)).size;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** "four" for 4, so a sentence can carry a count without anyone typing it. */
const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

const bootLog = (crew: Crew[], nights: Night[]) =>
  [
    "> section9.boot",
    "> mount /crew ................ ok",
    `> agents online .............. ${crew.length}`,
    `> nights shipped ............. ${nights.length}`,
    `> languages tried ............ ${languages(nights)}`,
    "> render ..................... petter.franzén",
  ]
    .map((line) => `<span class="boot-line">${escape(line)}</span>`)
    .join("");

const stats = (crew: Crew[], nights: Night[]) =>
  [
    { value: crew.length, label: "agents on the team" },
    { value: nights.length, label: "nights shipped" },
    { value: languages(nights), label: "languages tried" },
    { value: nights.length - count(nights, "pending"), label: "nights with a verdict" },
  ]
    .map(
      (stat) =>
        `<div class="stat"><dt>${escape(stat.label)}</dt><dd>${stat.value}</dd></div>`,
    )
    .join("");

const crewCards = (crew: Crew[]) =>
  crew
    .map(
      (agent) => `<li class="crew-card">
              <h4>${escape(agent.name)}</h4>
              <p class="crew-role">${escape(agent.role)}</p>
              <p class="crew-line">${escape(agent.line)}</p>
            </li>`,
    )
    .join("\n            ");

/** The verdict itself, once one has been written. */
const verdictText = (night: Night) =>
  night.standing === "pending" ? "" : `<span class="verdict-text">${escape(brief(night.verdict))}</span>`;

const tiles = (nights: Night[]) =>
  nights
    .map(
      (night, index) => `<li class="tile" data-index="${index}" data-url="${escape(night.url)}">
              <a class="tile-link" href="${escape(night.url)}" target="_blank" rel="noopener noreferrer">
                <span class="tile-top"><span class="tile-date">${escape(night.date)}</span><span class="tile-lang">${escape(night.language)}</span></span>
                <span class="tile-title">${escape(night.title)}</span>
                <span class="tile-idea">${escape(night.idea)}</span>
                ${verdictText(night)}
                <span class="tile-foot"><span class="tile-open">Open <span aria-hidden="true">↗</span><span class="sr-only"> ${escape(night.title)}</span></span><span class="verdict-badge" data-standing="${night.standing}"><span class="sr-only">Verdict: </span>${STANDING_LABEL[night.standing]}</span></span>
              </a>
              <div class="tile-preview" data-preview>
                <button class="tile-play" type="button" aria-label="Play a live preview of ${escape(night.title)}">Play preview</button>
              </div>
            </li>`,
    )
    .join("\n            ");

/** The newest nights that were liked, with the verdict that says so. */
const standouts = (nights: Night[]) =>
  nights
    .filter((night) => night.standing === "liked")
    .slice(0, STANDOUTS)
    .map(
      (night) => `<li class="pick">
              <p class="pick-top"><span>${escape(night.date)}</span><span class="pick-lang">${escape(night.language)}</span></p>
              <h4><a href="${escape(night.url)}" target="_blank" rel="noopener noreferrer">${escape(night.title)} <span aria-hidden="true">↗</span></a></h4>
              <p class="pick-idea">${escape(night.idea)}</p>
              <p class="pick-verdict"><span class="pick-verdict-label">Verdict</span> ${escape(brief(night.verdict))}</p>
            </li>`,
    )
    .join("\n            ");

const nightSummary = (nights: Night[]) =>
  [
    plural(nights.length, "night"),
    plural(languages(nights), "language"),
    `${count(nights, "liked")} liked`,
    `${count(nights, "reviewed")} reviewed`,
    `${count(nights, "pending")} awaiting review`,
  ]
    .map(escape)
    .join(' <span aria-hidden="true">·</span> ');

/**
 * Bakes the build-time content into index.html.
 *
 * Everything that grows or changes without anyone editing this repo — the
 * nightly experiments, their verdicts, the crew and every count on the page —
 * is written into the HTML here rather than fetched by the browser or typed in
 * by hand. The same plugin runs in dev and in the production build, so what
 * you see locally is what ships, and the page stays readable with JavaScript
 * off.
 */
function section9Content(): Plugin {
  let crew: Crew[] = [];
  let nights: Night[] = [];

  return {
    name: "section9-content",
    buildStart() {
      crew = read<Crew[]>("content/crew.json");
      nights = read<{ experiments: Night[] }>("src/experiments.generated.json").experiments;
    },
    transformIndexHtml(html) {
      return html
        .replace("<!--bootlog-->", bootLog(crew, nights))
        .replace("<!--stats-->", stats(crew, nights))
        .replace("<!--crew-->", crewCards(crew))
        .replaceAll("<!--crew-count-->", inWords(crew.length))
        .replaceAll("<!--Crew-count-->", capitalised(inWords(crew.length)))
        .replace("<!--experiments-->", tiles(nights))
        .replace("<!--standouts-->", standouts(nights))
        .replace("<!--night-summary-->", nightSummary(nights))
        .replace(/<span id="strip-count">\d+<\/span>/, `<span id="strip-count">${nights.length}</span>`);
    },
  };
}

export default defineConfig({
  plugins: [section9Content()],
  build: {
    target: "es2022",
    cssTarget: "chrome111",
    rollupOptions: {
      // Two documents, not one: the five acts, and the plain prose page that
      // explains how they are made. Each gets its own hashed assets.
      input: {
        index: path.resolve("index.html"),
        "how-this-was-built": path.resolve("how-this-was-built/index.html"),
      },
    },
  },
});
