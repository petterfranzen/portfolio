# Same shape as flight-tracker's frontend image: build the static Vite
# bundle, then serve it from nginx. The page is fully static — no API proxy.
#
# --- Build stage: produce the static bundle ---
# node:24-alpine — pinned by digest (the 2026-10-28 build; the tag's newest
# digest was pushed 2026-11-05, under 24 h old when this was pinned).
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /app

# Cache npm install in its own layer — only re-runs when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage: serve the static bundle ---
# nginx:1.27-alpine — pinned by digest (last pushed 2025-04-16).
FROM nginx:1.31-alpine@sha256:fb4658584bd9a916ffb6f6e365f97c25cfdb2923801f551ea08356e695f14ff7
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf

EXPOSE 80
