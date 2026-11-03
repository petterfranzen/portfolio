/**
 * The Demos list: the nightly experiments from ghost-in-the-machine, read from
 * /experiments.json.
 *
 * That file is baked into the image at build time (scripts/build-experiments.py,
 * run by CI), so this is a plain same-origin fetch of a static file: no
 * cross-origin call, no CORS or CSP to arrange, no third-party script, and the
 * page still reads correctly when the file is missing or empty.
 */
type Experiment = {
  date: string;
  folder: string;
  title: string;
  lang: string;
  url: string;
};

function escapeHtml(value: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export async function setupDemos() {
  const list = document.getElementById("demos-list");
  if (!list) return;

  let items: Experiment[] = [];
  try {
    const res = await fetch("/experiments.json", { cache: "no-cache" });
    if (res.ok) items = (await res.json()) as Experiment[];
  } catch {
    /* none: the static links beside the list still stand */
  }

  if (!items.length) {
    list.innerHTML =
      '<p class="lab-status">No experiments to list right now. The source for each project is linked in the Projects section above.</p>';
    return;
  }

  list.innerHTML = items
    .map(
      (it) =>
        `<a class="demo-card" href="${encodeURI(it.url)}" target="_blank" rel="noopener noreferrer">` +
        `<span class="demo-date">${escapeHtml(it.date)}</span>` +
        `<span class="demo-title">${escapeHtml(it.title)}</span>` +
        `<span class="demo-lang">${escapeHtml(it.lang)}</span></a>`,
    )
    .join("");
}
