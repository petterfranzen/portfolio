# Deploying the portfolio to the NAS

Same pipeline as the sibling projects: CI builds the image, the NAS pulls it.
Nothing is built on the NAS.

The page is static. The earlier landing page's Lab needed a same-origin proxy to
docker-monitor; that section and its `/lab-api/` proxy are gone, so this is now
one independent container. `deploy/docker-compose.yml` no longer joins
docker-monitor's network.

## 1. Publish the image

Push to `main` (or run the workflow manually from the Actions tab). This builds
for amd64 and arm64 and pushes to GHCR as
`ghcr.io/petterfranzen/portfolio:latest`.

## 2. Make the GHCR package pullable

GHCR packages are private by default — either make this one public (Package
settings → Change visibility), or `docker login ghcr.io` on the NAS with a PAT
carrying `read:packages`. Same choice as
[flight-tracker's deploy README](../../flight-tracker/deploy/README.md)
describes in more detail.

## 3. Run it

```bash
docker compose -f deploy/docker-compose.yml up -d
```

Then point the reverse proxy or the NAS's port mapping at port 8081 (or
`PORTFOLIO_PORT`).

Updating is the same: pull the new image tag and `docker compose up -d`.
