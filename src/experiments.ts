/**
 * The nightly experiments, as read from the build-time list.
 *
 * src/experiments.generated.json is written by scripts/build-experiments.mjs
 * before every build; it is committed so an offline build still ships a list.
 * index.html gets the same data baked in by the Vite plugin in vite.config.ts,
 * so the page reads without JavaScript; this module feeds the interactive
 * filmstrip on top of it.
 */
import data from "./experiments.generated.json";

export interface Experiment {
  /** Date of the night, "YYYY-MM-DD". */
  date: string;
  /** Folder in the source repo, "YYYY-MM-DD-<slug>". */
  slug: string;
  /** Display title derived from the slug, e.g. "Koi Drift". */
  title: string;
  /** Language it was written in. */
  language: string;
  /** One line on the idea, from the repo's LOG.md. */
  idea: string;
  /** The published page for this night. */
  url: string;
}

/** Every night so far, newest first. */
export const EXPERIMENTS: Experiment[] = data.experiments;

/** The index for the whole run. */
export const EXPERIMENTS_INDEX: string = data.index;

/** The crew page: who builds the nights. */
export const CREW_URL: string = data.crew;
