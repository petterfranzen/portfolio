# Same shape as flight-tracker's frontend image: build the static Vite
# bundle, then serve it from nginx, which also proxies the Lab's API calls
# to docker-monitor.
#
# --- Build stage: produce the static bundle ---
FROM node:24-alpine AS build
WORKDIR /app

# Cache npm install in its own layer — only re-runs when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage: serve it, and front the control API ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
