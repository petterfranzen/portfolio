# Same shape as flight-tracker's frontend image: build the static Vite
# bundle, then serve it from nginx. The page is fully static — no API proxy.
#
# --- Build stage: produce the static bundle ---
# node:24-alpine — pinned by digest (the 2026-10-28 build; the tag's newest
# digest was pushed 2026-11-05, under 24 h old when this was pinned).
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build
WORKDIR /app

# Cache npm install in its own layer — only re-runs when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage: serve the static bundle ---
# nginx:1.27-alpine — pinned by digest (last pushed 2025-04-16).
FROM nginx:1.31-alpine@sha256:713fc2ebfd92e8217db451477182ee91944b123d2b1ee9fd5a8c6e91ca6c3a11
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
