#!/bin/bash
# Pre-install (warm) all 7 reference MCP server packages into the npx and uvx
# caches so the first agent request doesn't have to download them on demand.
#
# npx caches packages under ~/.npm/_npx
# uvx caches packages under ~/.cache/uv
#
# After this script runs once (during image build, postinstall, or CI setup),
# spawning any of the reference MCP servers is a sub-second operation instead
# of a 30-60s download.
#
# This script is idempotent and safe to run multiple times. If a package is
# already cached, npx/uvx will detect it and exit quickly.
#
# Usage:
#   bash scripts/preinstall-mcp.sh           # install all
#   bash scripts/preinstall-mcp.sh --check   # only verify, exit non-zero if any missing

set -euo pipefail

# Colors for status output (disabled if not a TTY)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  NC='\033[0m'
else
  GREEN='' YELLOW='' RED='' NC=''
fi

CHECK_ONLY=false
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=true
fi

log() { echo -e "${GREEN}[mcp-preinstall]${NC} $*"; }
warn() { echo -e "${YELLOW}[mcp-preinstall]${NC} $*"; }
err() { echo -e "${RED}[mcp-preinstall]${NC} $*" >&2; }

# Each entry: "name|runtime|package|verify-command"
# - runtime: npx or uvx
# - package: the package spec passed to npx/uvx
# - verify-command: a fast command that exits 0 if the package is cached.
#   We check the cache directory directly instead of spawning the server,
#   because spawning takes ~500ms even when cached (and some MCP servers
#   don't have a --help that exits cleanly).
#
# npx cache: ~/.npm/_npx (package contents extracted into a hashed dir)
# uvx cache: /var/cache/uv or ~/.cache/uv (archive-v0 dir contains
#            site-packages with the mcp_server_* package)
SPECS=(
  "memory|npx|@modelcontextprotocol/server-memory|find ~/.npm/_npx -type d -name 'server-memory' 2>/dev/null | head -1 | grep -q ."
  "sequentialthinking|npx|@modelcontextprotocol/server-sequential-thinking|find ~/.npm/_npx -type d -name 'server-sequential-thinking' 2>/dev/null | head -1 | grep -q ."
  "everything|npx|@modelcontextprotocol/server-everything|find ~/.npm/_npx -type d -name 'server-everything' 2>/dev/null | head -1 | grep -q ."
  "filesystem|npx|@modelcontextprotocol/server-filesystem|find ~/.npm/_npx -type d -name 'server-filesystem' 2>/dev/null | head -1 | grep -q ."
  "time|uvx|mcp-server-time|find /var/cache/uv ~/.cache/uv -type d -name 'mcp_server_time' 2>/dev/null | head -1 | grep -q ."
  "fetch|uvx|mcp-server-fetch|find /var/cache/uv ~/.cache/uv -type d -name 'mcp_server_fetch*' 2>/dev/null | head -1 | grep -q ."
  "git|uvx|mcp-server-git|find /var/cache/uv ~/.cache/uv -type d -name 'mcp_server_git' 2>/dev/null | head -1 | grep -q ."
)

# Count available runtimes
have_npx=true
have_uvx=true
command -v npx >/dev/null 2>&1 || have_npx=false
command -v uvx >/dev/null 2>&1 || have_uvx=false

if [ "$have_npx" = "false" ] && [ "$have_uvx" = "false" ]; then
  err "Neither npx nor uvx found. Install Node.js (for npx) and/or uv (for uvx) first."
  exit 1
fi

[ "$have_npx" = "false" ] && warn "npx not found — skipping npm-based MCP servers"
[ "$have_uvx" = "false" ] && warn "uvx not found — skipping PyPI-based MCP servers"

# Set a long timeout for the install phase (first-time downloads can be slow)
# but a short timeout for the verify phase.
INSTALL_TIMEOUT=180   # 3 minutes per package for first download
VERIFY_TIMEOUT=15     # 15 seconds for cached verification

installed=0
skipped=0
failed=0
failed_names=()

for spec in "${SPECS[@]}"; do
  IFS='|' read -r name runtime package verify_cmd <<< "$spec"

  # Skip if runtime isn't available
  if [ "$runtime" = "npx" ] && [ "$have_npx" = "false" ]; then
    warn "skipping $name (npx not available)"
    skipped=$((skipped + 1))
    continue
  fi
  if [ "$runtime" = "uvx" ] && [ "$have_uvx" = "false" ]; then
    warn "skipping $name (uvx not available)"
    skipped=$((skipped + 1))
    continue
  fi

  if [ "$CHECK_ONLY" = "true" ]; then
    # Just verify, don't install
    if timeout "$VERIFY_TIMEOUT" bash -c "$verify_cmd" >/dev/null 2>&1; then
      log "OK: $name ($package)"
      installed=$((installed + 1))
    else
      err "MISSING: $name ($package)"
      failed=$((failed + 1))
      failed_names+=("$name")
    fi
    continue
  fi

  log "warming cache for $name ($package)..."
  if [ "$runtime" = "npx" ]; then
    # Spawn the server in the background. It will download & cache the
    # package, then block waiting for stdio input. We poll the npx cache
    # directory until the package appears, then kill the server.
    timeout 180 npx --yes "$package" </dev/null >/dev/null 2>&1 &
    PID=$!
    # Wait up to 3 min for the package to appear in the cache
    WAITED=0
    while [ "$WAITED" -lt 180 ]; do
      if timeout 5 bash -c "$verify_cmd" >/dev/null 2>&1; then
        break
      fi
      sleep 2
      WAITED=$((WAITED + 2))
    done
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
    if timeout 5 bash -c "$verify_cmd" >/dev/null 2>&1; then
      log "OK: $name (cached after ${WAITED}s)"
      installed=$((installed + 1))
    else
      err "FAILED: $name (not in cache after ${WAITED}s)"
      failed=$((failed + 1))
      failed_names+=("$name")
    fi
  else  # uvx
    timeout 180 uvx --quiet "$package" </dev/null >/dev/null 2>&1 &
    PID=$!
    WAITED=0
    while [ "$WAITED" -lt 180 ]; do
      if timeout 5 bash -c "$verify_cmd" >/dev/null 2>&1; then
        break
      fi
      sleep 2
      WAITED=$((WAITED + 2))
    done
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
    if timeout 5 bash -c "$verify_cmd" >/dev/null 2>&1; then
      log "OK: $name (cached after ${WAITED}s)"
      installed=$((installed + 1))
    else
      err "FAILED: $name (not in cache after ${WAITED}s)"
      failed=$((failed + 1))
      failed_names+=("$name")
    fi
  fi
done

echo ""
echo "------------------------------------------------"
echo "MCP preinstall summary:"
echo "  installed/verified: $installed"
echo "  skipped (runtime unavailable): $skipped"
echo "  failed: $failed"
if [ "$failed" -gt 0 ]; then
  echo "  failed packages: ${failed_names[*]}"
fi
echo "------------------------------------------------"

if [ "$CHECK_ONLY" = "true" ] && [ "$failed" -gt 0 ]; then
  exit 1
fi

exit 0
