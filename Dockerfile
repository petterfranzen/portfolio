# Same shape as flight-tracker's frontend image: build the static Vite
# bundle, then serve it from nginx. The page is fully static — no API proxy.
#
# --- Build stage: produce the static bundle ---
# node:24-alpine (the LTS line CI runs, ci.yml) — pinned by digest, the tag's
# digest pushed 2026-11-11.
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
WORKDIR /app

# Cache npm install in its own layer — only re-runs when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Ship the committed, reviewed night list: no fetch from ghost-in-the-machine
# at image build time (scripts/build-experiments.mjs honours this).
ENV EXPERIMENTS_OFFLINE=1
RUN npm run build

# --- Runtime stage: serve the static bundle ---
# nginx:1.31-alpine — pinned by digest, the tag's digest pushed 2026-11-25.
FROM nginx:1.31-alpine@sha256:7fc0fb4af7bf006aeb31aea88069976060f8f0a0a86b667126742cc17f4e31ae
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf

EXPOSE 80
# A dead nginx is reported unhealthy instead of just "running".
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
