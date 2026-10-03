# Multi-stage Dockerfile for agentic-chat.
#
# Build stage: install npm deps and run next build (standalone output).
# Runtime stage: copy the standalone server, static assets and public files.
#
# The chat is a client of a Nexum server; point it at one with NEXUM_HOST_URL
# (default http://127.0.0.1:3777) and, if that server requires it,
# NEXUM_SERVER_TOKEN.
#
# Usage:
#   docker build -t agentic-chat .
#   docker run -p 3400:3400 -e NEXUM_HOST_URL=http://host.docker.internal:3777 agentic-chat

# ── Build stage ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the source and build
COPY . .
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3400
ENV HOSTNAME=0.0.0.0

# The standalone server output already includes node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Health check: poll the /api health endpoint every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3400/api').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 3400

CMD ["node", "server.js"]
