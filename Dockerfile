# Same shape as flight-tracker's frontend image: build the static Vite
# bundle, then serve it from nginx. The page is fully static — no API proxy.
#
# --- Build stage: produce the static bundle ---
# node:24-alpine — pinned by digest (the 2026-10-28 build; the tag's newest
# digest was pushed 2026-11-05, under 24 h old when this was pinned).
FROM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build
WORKDIR /app

# Cache npm install in its own layer — only re-runs when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage: serve the static bundle ---
# nginx:1.27-alpine — pinned by digest (last pushed 2025-04-16).
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
