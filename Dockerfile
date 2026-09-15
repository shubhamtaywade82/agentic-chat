# Multi-stage Dockerfile for agentic-chat.
#
# Build stage:
#   1. Install npm deps (which triggers the postinstall MCP preinstall script)
#   2. Run next build (standalone output)
#   3. Warm the npx/uvx caches for all 7 reference MCP packages so the first
#      agent request after container start is sub-second instead of 30-60s
#
# Runtime stage:
#   1. Copy the standalone server + static assets + public
#   2. Copy the warmed npx/uvx caches from the build stage
#   3. Install npx (node) and uvx (uv) in the runtime image
#   4. Run the standalone server on port 3400
#
# Usage:
#   docker build -t agentic-chat .
#   docker run -p 3400:3400 agentic-chat
#
# The resulting image is ~300MB and starts in ~2s. The first agent request
# reuses the pre-warmed MCP caches so there's no download latency.

# ── Build stage ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

# Install uv (for uvx — needed by the Python-based MCP servers: time, fetch, git)
# Done in the build stage so the cache-warming step below can use it.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package.json package-lock.json* ./
COPY packages ./packages

# Install deps. The postinstall script runs preinstall-mcp.sh, but it's
# non-fatal — if npx/uvx fail (e.g. no network), the install still succeeds
# and the MCP servers will be downloaded on first request instead.
RUN npm ci

# Copy the rest of the source and build
COPY . .
RUN npm run build

# Warm the npx and uvx caches for all 7 reference MCP packages.
# This is the key step: it pre-downloads everything so the runtime image
# can spawn MCP servers in <1s instead of 30-60s.
# Done in the build stage so the warmed caches get copied to the runtime image.
RUN bash scripts/preinstall-mcp.sh || echo "MCP preinstall failed (non-fatal)"

# ── Runtime stage ───────────────────────────────────────────────────────
FROM node:20-slim AS runner

# Install uv in the runtime image (needed for uvx-based MCP servers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3400
ENV HOSTNAME=0.0.0.0

# Copy the standalone server output (already includes node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the warmed npx and uvx caches from the build stage so the runtime
# doesn't have to re-download MCP packages on first request.
# npx cache: ~/.npm/_npx
# uvx cache: ~/.cache/uv
COPY --from=builder /root/.npm/_npx /root/.npm/_npx
COPY --from=builder /root/.cache/uv /root/.cache/uv

# Health check: poll the /api health endpoint every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3400/api').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 3400

# Run the standalone server
CMD ["node", "server.js"]
