/**
 * The Lab: live status for the projects running on the home NAS, and
 * buttons to start one for a demo.
 *
 * Talks to docker-monitor's control API (see ../docker-monitor) through
 * this site's own nginx at /lab-api/, so it's same-origin — the monitor is
 * never exposed to the internet directly, and there's no CORS to arrange.
 *
 * Vanilla TypeScript on purpose: the rest of this site has no framework,
 * and a handful of cards re-rendered on a server event doesn't justify
 * introducing one.
 *
 * Every piece of state shown here comes from the API. Nothing is inferred
 * locally except the lease countdown, which ticks down from the last
 * known value so the number moves once a second without asking the server
 * once a second.
 */

const API_BASE = "/lab-api";
const POLL_FALLBACK_MS = 5000;

type Lease = {
  project: string;
  started_by: string;
  started_at: number;
  expires_at: number;
  seconds_remaining: number;
};

type Project = {
  name: string;
  display_name: string;
  description: string;
  state: "running" | "partial" | "stopped" | "starting" | "stopping";
  phase: string | null;
  phase_label: string | null;
  phase_detail: string;
  demo_url: string;
  repo_url: string;
  demo_ready: boolean;
  controllable: boolean;
  guest_controllable: boolean;
  always_on: boolean;
  known: boolean;
  default_ttl_minutes: number;
  busy: boolean;
  lease: Lease | null;
};

type Snapshot = {
  generated_at: number;
  max_concurrent_guest_projects: number;
  active_guest_projects: number;
  projects: Project[];
};

const STATE_LABELS: Record<Project["state"], string> = {
  running: "Running",
  partial: "Partly up",
  stopped: "Stopped",
  starting: "Starting",
  stopping: "Stopping",
};

let snapshot: Snapshot | null = null;
let notice = "";
let container: HTMLElement | null = null;

/* ---------- rendering ---------- */

/** A bare duration — the caller supplies the sentence around it. */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes >= 1) return `${minutes}m`;
  return `${seconds}s`;
}

function countdownText(seconds: number): string {
  return seconds <= 0 ? "Stopping now…" : `Stops automatically in ${formatDuration(seconds)}`;
}

/**
 * Countdown from the last server value rather than re-reading the clock
 * from the API: the server sends state changes, not a tick per second,
 * and a number frozen between events looks broken.
 */
function secondsRemaining(lease: Lease): number {
  return Math.max(0, Math.round(lease.expires_at - Date.now() / 1000));
}

function describePhase(project: Project): string {
  if (!project.phase_label) return "";
  return project.phase_detail
    ? `${project.phase_label} — ${project.phase_detail}`
    : project.phase_label;
}

function card(project: Project, capacityFull: boolean): string {
  const busy = project.busy || project.state === "starting" || project.state === "stopping";
  const running = project.state === "running" || project.state === "partial";
  const phase = describePhase(project);

  // A guest may be blocked for a reason worth explaining rather than a
  // disabled button with no rationale.
  let blocked = "";
  if (!project.guest_controllable) {
    blocked = "Not available for visitor demos.";
  } else if (!running && capacityFull) {
    blocked = "Someone else is running a demo right now — try again shortly.";
  }

  const canStart = project.guest_controllable && !busy && !running && !capacityFull;
  const canStop = project.guest_controllable && !busy && running;

  const lease = project.lease;
  const leaseLine =
    running && lease
      ? `<p class="lab-lease" data-expires="${lease.expires_at}">${countdownText(secondsRemaining(lease))}</p>`
      : "";

  // The demo link appears only once the API says the stack is actually
  // usable — a frontend that's "healthy" while the database is still
  // filling renders an empty map, and a link to that is worse than no
  // link.
  const demoLink =
    project.demo_ready && project.demo_url
      ? `<a class="button button-primary lab-open" href="${project.demo_url}" target="_blank" rel="noopener">Open demo ↗</a>`
      : "";

  return `
    <article class="project-card lab-card" data-project="${project.name}">
      <div class="project-card-head">
        <h3>${project.display_name}</h3>
        <span class="project-badge lab-state lab-state-${project.state}">
          ${STATE_LABELS[project.state] ?? project.state}
        </span>
      </div>

      ${project.description ? `<p>${project.description}</p>` : ""}

      <p class="lab-phase" aria-live="polite">${phase || "&nbsp;"}</p>
      ${leaseLine}
      ${blocked ? `<p class="lab-blocked">${blocked}</p>` : ""}

      <div class="project-card-foot lab-actions">
        <button class="button lab-button" data-action="start" data-project="${project.name}" ${canStart ? "" : "disabled"}>
          ${project.state === "starting" ? "Starting…" : "Start demo"}
        </button>
        <button class="button lab-button" data-action="stop" data-project="${project.name}" ${canStop ? "" : "disabled"}>
          ${project.state === "stopping" ? "Stopping…" : "Stop"}
        </button>
        ${demoLink}
        ${project.repo_url ? `<a class="lab-repo" href="${project.repo_url}" target="_blank" rel="noopener">Source ↗</a>` : ""}
      </div>
    </article>`;
}

function render(): void {
  if (!container) return;

  if (!snapshot) {
    container.innerHTML = `<p class="lab-status">Checking what's running…</p>`;
    return;
  }

  // Projects discovered on the host but not configured as demos are
  // deliberately not listed: they're someone's infrastructure, not part
  // of a portfolio.
  const projects = snapshot.projects.filter((p) => p.known && p.guest_controllable);

  if (projects.length === 0) {
    container.innerHTML = `<p class="lab-status">No demo projects are configured right now.</p>`;
    return;
  }

  const capacityFull = snapshot.active_guest_projects >= snapshot.max_concurrent_guest_projects;

  container.innerHTML = `
    ${notice ? `<p class="lab-notice" role="status">${notice}</p>` : ""}
    <div class="project-grid">${projects.map((p) => card(p, capacityFull)).join("")}</div>`;
}

/** Ticks the countdowns between server events, without a re-render. */
function tickCountdowns(): void {
  document.querySelectorAll<HTMLElement>(".lab-lease").forEach((el) => {
    const expires = Number(el.dataset.expires);
    if (!expires) return;
    el.textContent = countdownText(Math.max(0, Math.round(expires - Date.now() / 1000)));
  });
}

/* ---------- talking to the API ---------- */

async function refresh(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/projects`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(String(response.status));
    snapshot = (await response.json()) as Snapshot;
    render();
  } catch {
    if (!snapshot && container) {
      container.innerHTML = `<p class="lab-status">The NAS isn't reachable right now — it's a home server, so it's occasionally off. The source links on each project still work.</p>`;
    }
  }
}

async function act(project: string, action: "start" | "stop"): Promise<void> {
  notice = "";
  try {
    const response = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(project)}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "start" ? JSON.stringify({}) : undefined,
    });

    if (!response.ok) {
      // The API's refusals are all things a visitor can act on — rate
      // limited, someone else is using it — so show what it said rather
      // than a generic failure.
      const body = await response.json().catch(() => null);
      notice = body?.detail ?? `Could not ${action} that just now (HTTP ${response.status}).`;
    } else if (action === "start") {
      notice = "Starting — this takes a minute or so while the containers come up.";
    }
  } catch {
    notice = "Couldn't reach the NAS just now.";
  }
  await refresh();
}

/**
 * Live updates. The API pushes on every meaningful change, which is what
 * makes a stack booting visible rather than something you refresh at.
 * Polling is the fallback for browsers or proxies that break SSE.
 */
function connect(): void {
  let pollTimer: number | undefined;

  const startPolling = () => {
    if (pollTimer !== undefined) return;
    pollTimer = window.setInterval(refresh, POLL_FALLBACK_MS);
  };

  try {
    const events = new EventSource(`${API_BASE}/api/events`);

    events.addEventListener("projects", (event) => {
      try {
        snapshot = JSON.parse((event as MessageEvent).data) as Snapshot;
        render();
      } catch {
        /* a malformed frame shouldn't kill the stream */
      }
    });

    events.onerror = () => {
      // EventSource reconnects on its own; polling covers the gap and is
      // harmless if the stream comes back.
      startPolling();
    };
  } catch {
    startPolling();
  }
}

export function setupLab(): void {
  container = document.getElementById("lab-projects");
  if (!container) return;

  container.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button || button.disabled) return;
    const project = button.dataset.project;
    const action = button.dataset.action as "start" | "stop";
    if (!project) return;

    // Disable immediately: a compose operation takes seconds to even
    // register as "busy" server-side, and a second click in that window
    // is refused with a 409 the visitor has no way to understand.
    button.disabled = true;
    void act(project, action);
  });

  void refresh();
  connect();
  window.setInterval(tickCountdowns, 1000);
}
