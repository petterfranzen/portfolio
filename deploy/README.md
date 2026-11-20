# Deploying the portfolio to the NAS

Same pipeline as the sibling projects: CI builds the image, the NAS pulls it.
Nothing is built on the NAS.

The page is static. The earlier landing page's Lab needed a same-origin proxy to
docker-monitor; that section and its `/lab-api/` proxy are gone, so this is now
one independent container. `deploy/docker-compose.yml` no longer joins
docker-monitor's network.

## 1. Publish the image

Merging a PR to `main` runs `.github/workflows/docker-publish.yml`. It
publishes only from `main` — a branch, a tag or a manual run cannot publish
it — and it writes exactly one immutable tag for the commit,
`sha-<short>`. There is no moving `latest`: read the tag off the run's
summary (or the package's version list) and use it in step 3.

## 2. Make the GHCR package pullable

GHCR packages are private by default — either make this one public (Package
settings → Change visibility), or `docker login ghcr.io` on the NAS with a PAT
carrying `read:packages`. Same choice as
[flight-tracker's deploy README](../../flight-tracker/deploy/README.md)
describes in more detail.

## 3. Run it

```bash
IMAGE_TAG=sha-<short> docker compose -f deploy/docker-compose.yml up -d
```

`IMAGE_TAG` is required: the compose file deliberately has no default, so an
unset tag is an error rather than a silent pull of whatever last wrote
`latest`.

Then point the reverse proxy or the NAS's port mapping at port 8081 (or
`PORTFOLIO_PORT`).

Updating is the same: set `IMAGE_TAG` to the new `sha-<short>` and run
`docker compose up -d`. Redeploying an old tag always brings back that exact
build, because the tag never moves.
