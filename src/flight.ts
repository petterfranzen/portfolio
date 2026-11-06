/**
 * The Flight Tracker backdrop: a quiet world graticule with aircraft moving
 * along great-circle-ish arcs. Canvas rather than DOM so a dozen arcs and
 * their trails cost one paint, and only while the act is on screen.
 *
 * Deliberately decorative: the canvas is aria-hidden, and under reduced motion
 * it draws a still frame and stops.
 */

interface Hub {
  name: string;
  lon: number;
  lat: number;
}

const HUBS: Record<string, Hub> = {
  arn: { name: "Stockholm", lon: 18.07, lat: 59.33 },
  lon: { name: "London", lon: -0.12, lat: 51.5 },
  jfk: { name: "New York", lon: -74.0, lat: 40.71 },
  dxb: { name: "Dubai", lon: 55.27, lat: 25.2 },
  sin: { name: "Singapore", lon: 103.82, lat: 1.35 },
  hnd: { name: "Tokyo", lon: 139.69, lat: 35.68 },
  gru: { name: "São Paulo", lon: -46.63, lat: -23.55 },
  nbo: { name: "Nairobi", lon: 36.82, lat: -1.29 },
  lax: { name: "Los Angeles", lon: -118.24, lat: 34.05 },
  syd: { name: "Sydney", lon: 151.21, lat: -33.87 },
  del: { name: "Delhi", lon: 77.21, lat: 28.61 },
  kef: { name: "Reykjavík", lon: -21.94, lat: 63.99 },
};

/** Pairs chosen so no arc has to cross the map's date-line seam. */
const ROUTES: Array<[string, string]> = [
  ["arn", "lon"],
  ["arn", "kef"],
  ["arn", "dxb"],
  ["arn", "del"],
  ["lon", "jfk"],
  ["lon", "nbo"],
  ["jfk", "lax"],
  ["jfk", "gru"],
  ["dxb", "sin"],
  ["dxb", "nbo"],
  ["sin", "hnd"],
  ["sin", "syd"],
  ["del", "hnd"],
  ["kef", "jfk"],
  ["gru", "nbo"],
  ["lax", "hnd"],
];

interface Arc {
  from: Hub;
  to: Hub;
  offset: number;
  speed: number;
  curve: number;
}

function buildArcs(): Arc[] {
  return ROUTES.map(([a, b], index) => ({
    from: HUBS[a],
    to: HUBS[b],
    offset: (index * 0.173) % 1,
    speed: 0.000035 + ((index * 37) % 17) * 0.000002,
    curve: 0.16 + ((index * 13) % 9) * 0.018,
  }));
}

export function initFlightArcs(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => {};

  const arcs = buildArcs();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let frame = 0;
  let running = false;
  let colours = { cyan: "61, 255, 208", hot: "255, 77, 109" };

  const readColours = () => {
    const styles = getComputedStyle(document.documentElement);
    const cyan = styles.getPropertyValue("--cyan").trim();
    const hot = styles.getPropertyValue("--hot").trim();
    colours = { cyan: toRgb(cyan, "61, 255, 208"), hot: toRgb(hot, "255, 77, 109") };
  };

  function toRgb(value: string, fallback: string): string {
    if (value.startsWith("#")) {
      const hex = value.slice(1);
      const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
      const number = Number.parseInt(full, 16);
      if (Number.isFinite(number)) {
        return `${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}`;
      }
    }
    return fallback;
  }

  const project = (hub: Hub) => ({
    x: width * 0.06 + ((hub.lon + 180) / 360) * width * 0.88,
    y: height * 0.12 + ((90 - hub.lat) / 180) * height * 0.76,
  });

  const bezier = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    t: number,
  ) => {
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    };
  };

  const draw = (time: number) => {
    if (!context || width === 0 || height === 0) return;
    context.clearRect(0, 0, width, height);

    // Graticule: quiet, but enough to read as a map.
    context.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = width * 0.06 + ((lon + 180) / 360) * width * 0.88;
      context.strokeStyle = `rgba(${colours.cyan}, 0.045)`;
      context.beginPath();
      context.moveTo(x, height * 0.12);
      context.lineTo(x, height * 0.88);
      context.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = height * 0.12 + ((90 - lat) / 180) * height * 0.76;
      context.strokeStyle = `rgba(${colours.cyan}, 0.045)`;
      context.beginPath();
      context.moveTo(width * 0.06, y);
      context.lineTo(width * 0.94, y);
      context.stroke();
    }

    for (const arc of arcs) {
      const a = project(arc.from);
      const b = project(arc.to);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      const control = {
        x: mid.x - (dy / length) * length * arc.curve,
        y: mid.y + (dx / length) * length * arc.curve - length * 0.12,
      };

      context.strokeStyle = `rgba(${colours.cyan}, 0.13)`;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.quadraticCurveTo(control.x, control.y, b.x, b.y);
      context.stroke();

      const head = reduce.matches ? 0.55 : (time * arc.speed + arc.offset) % 1;
      const tailStart = Math.max(0, head - 0.14);
      const steps = 18;
      let previous = bezier(a, b, control, tailStart);
      for (let step = 1; step <= steps; step += 1) {
        const t = tailStart + ((head - tailStart) * step) / steps;
        const point = bezier(a, b, control, t);
        const alpha = 0.06 + (step / steps) * 0.55;
        context.strokeStyle = `rgba(${colours.cyan}, ${alpha.toFixed(3)})`;
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(previous.x, previous.y);
        context.lineTo(point.x, point.y);
        context.stroke();
        previous = point;
      }

      const dot = bezier(a, b, control, head);
      context.fillStyle = `rgba(${colours.hot}, 0.9)`;
      context.beginPath();
      context.arc(dot.x, dot.y, 1.8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = `rgba(${colours.hot}, 0.16)`;
      context.beginPath();
      context.arc(dot.x, dot.y, 6, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = `rgba(${colours.cyan}, 0.5)`;
      context.beginPath();
      context.arc(a.x, a.y, 1.1, 0, Math.PI * 2);
      context.arc(b.x, b.y, 1.1, 0, Math.PI * 2);
      context.fill();
    }
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    width = rect.width;
    height = rect.height;
    draw(performance.now());
  };

  const loop = (time: number) => {
    if (!running) return;
    draw(time);
    frame = requestAnimationFrame(loop);
  };

  const start = () => {
    if (running) return;
    running = true;
    readColours();
    resize();
    if (!reduce.matches) frame = requestAnimationFrame(loop);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start();
        else stop();
      }
    },
    { rootMargin: "120px" },
  );
  observer.observe(canvas);

  window.addEventListener("resize", resize);
  const themeObserver = new MutationObserver(() => {
    readColours();
    draw(performance.now());
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const motionListener = () => {
    stop();
    start();
  };
  reduce.addEventListener("change", motionListener);

  return () => {
    stop();
    observer.disconnect();
    themeObserver.disconnect();
    reduce.removeEventListener("change", motionListener);
    window.removeEventListener("resize", resize);
  };
}
