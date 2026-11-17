/**
 * The five-act page's entry point. Each act's behaviour lives in its own
 * module; this only starts them and shares one scroll frame between the
 * parts that need it.
 */
import "./style.css";
import { initAtmosphere } from "./atmosphere.js";
import { initBoot } from "./boot.js";
import { $, root } from "./dom.js";
import { initFilmstrip } from "./filmstrip.js";
import { initFlightArcs } from "./flight.js";
import { initPalette } from "./palette.js";
import { initPipeline } from "./pipeline.js";
import { initRail } from "./rail.js";
import { initTheme } from "./theme.js";

initTheme();
initAtmosphere();
initBoot();

const updatePipeline = initPipeline();
const updateFilmstrip = initFilmstrip();
const onScroll = initRail(() => {
  updatePipeline();
  updateFilmstrip();
});
initPalette();

/* Act 3's backdrop. */
const arcs = $<HTMLCanvasElement>("#arcs");
if (arcs) initFlightArcs(arcs);

onScroll();
window.addEventListener("load", onScroll);

/* A readiness flag for tests and for anything that needs to know the
   interaction layer is live (the boot sequence still runs after this). */
root.dataset.ready = "true";
