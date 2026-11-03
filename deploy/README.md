# Deploying the portfolio

## Production: the Hetzner VM at `www.pastabake.cloud`

The live site is pulled by the VM itself, not pushed to it: `agent-manager`'s
`deploy/vm-sync.sh` (`portfolio_sync`) reads this repo's `main`, waits for its
CI, pulls `ghcr.io/petterfranzen/portfolio:sha-<sha>`, pins the digest and
recreates one container on `127.0.0.1:8081`. Merging to `main` is the whole
deploy. It needs nothing here except two things, both already set:

- the GHCR package is **public**, so the VM pulls without a token;
- `main` carries tags `sha-<short>`, which `docker/metadata-action` already does.

See `agent-manager/docs/DECISIONS.md` (2026-11-01). The VM's sync polls
`/healthz`, which nginx answers with a plain `200 ok` — no version, no hostname.

## The NAS route

The pipeline is the same for the NAS: CI builds the image, the NAS pulls it.
Nothing is built on the NAS. This is the older, home route; the NAS is also
where docker-monitor runs.

### 1. Publish the image

Push to `main` (or run the workflow manually from the Actions tab). This
builds for amd64 and arm64 and pushes to GHCR as
`ghcr.io/petterfranzen/portfolio:latest`.

### 2. Make the GHCR package pullable

GHCR packages are private by default — either make this one public
(Package settings → Change visibility), or `docker login ghcr.io` on the
NAS with a PAT carrying `read:packages`.

### 3. Run it

```bash
cd ~/portfolio
docker compose pull
docker compose up -d
```

Open `http://<nas-ip>:8081` (or whatever `PORTFOLIO_PORT` you set).

### Exposing it to the internet

Whatever you use (tunnel, reverse proxy, port forward), point it at this
container's port. The container serves only the static site: there is no
`/lab-api/` proxy to docker-monitor any more (see `../nginx.conf`), so nothing
else is reachable through it and nothing needs to share a Docker network with
it.
