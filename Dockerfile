# Same shape as flight-tracker's frontend image: build the static Vite
# bundle, then serve it from nginx. nginx no longer proxies anything: the
# Lab's /lab-api/ door to docker-monitor is gone (see nginx.conf).
#
# --- Build stage: produce the static bundle ---
FROM node:24-alpine AS build
WORKDIR /app

# Cache npm install in its own layer — only re-runs when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

# python3 is only needed to bake the Demos list below; it never reaches the
# runtime image (this stage is discarded).
RUN apk add --no-cache python3

COPY . .
# Bake the list into the image: the site then never fetches across origins at
# run time, and a Pages blip costs a shorter list, not a broken build. The
# script writes public/experiments.json, which Vite copies into dist/ below.
RUN python3 scripts/build-experiments.py
RUN npm run build

# --- Runtime stage: serve the static bundle ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
