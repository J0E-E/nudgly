# Stage 1: build static assets. Stage 2: nginx serves them.
# Build from repo root: docker build -f frontend/Dockerfile .
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Same-origin when browser hits nginx: /api and /health proxied to backend
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY frontend/ ./
RUN npm run build

# Stage 2: nginx serves the SPA (for internal use; main nginx proxies / here)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Default nginx.conf serves static from /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
