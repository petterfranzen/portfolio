# Deploying the portfolio to the NAS

Same pipeline as the sibling projects: CI builds the image, the NAS pulls
it. Nothing is built on the NAS.

## 1. Publish the image

Push to `main` (or run the workflow manually from the Actions tab). This
builds for amd64 and arm64 and pushes to GHCR as
`ghcr.io/petterfranzen/portfolio:latest`.

## 2. Make the GHCR package pullable

GHCR packages are private by default — either make this one public
(Package settings → Change visibility), or `docker login ghcr.io` on the
NAS with a PAT carrying `read:packages`. Same choice as
[flight-tracker's deploy README](../../flight-tracker/deploy/README.md)
describes in more detail.

## Simpler alternative: one combined stack

If you're deploying the whole Lab at once — and especially if you're
pasting YAML into UGOS's Docker app rather than using a terminal — use
[`docker-monitor/deploy/lab-stack.yml`](../../docker-monitor/deploy/lab-stack.yml)
instead of this file. It runs the socket proxy, ntfy, docker-monitor and
this site as a single Compose project, so there's no external network to
line up and no separate `projects.json` to place on disk.

The rest of this file is the split-project route, where the portfolio is
its own Compose project joining docker-monitor's network.

## 3. Bring up docker-monitor first

The Lab section talks to docker-monitor through this container's nginx, at
the hostname `docker-monitor` on that project's compose network. So:

```bash
cd ~/docker-monitor && docker compose up -d
docker network ls | grep docker-monitor   # confirm the network name
```

If the network isn't called `docker-monitor_default`, update the
`networks:` block at the bottom of `docker-compose.yml` to match.

## 4. Run it

```bash
cd ~/portfolio
docker compose pull
docker compose up -d
```

Open `http://<nas-ip>:8081` (or whatever `PORTFOLIO_PORT` you set).

## 5. Turn on the proxy-header trust, once, over in docker-monitor

The Lab's guest rate limits are counted per client IP, and docker-monitor
only believes the `X-Forwarded-For` header when explicitly told to. Set
`TRUST_PROXY_HEADERS=true` in docker-monitor's environment **only once
this proxy is the way in** — i.e. once its own API port isn't reachable
from outside the NAS. Getting this backwards means a visitor can forge the
header and get a fresh identity per request, which defeats the limits
entirely. docker-monitor's README says more under "Security notes".

## Exposing it to the internet

Whatever you use (tunnel, reverse proxy, port forward), point it at this
container's port and **not** at docker-monitor's. The whole design assumes
this nginx is the only door in.

Terminate TLS in front of it: docker-monitor's `CONTROL_TOKEN` is a bearer
token, and over plain HTTP anything on the path can read it.
