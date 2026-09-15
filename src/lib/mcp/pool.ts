// McpConnectionPool — a process-global pool of long-lived MCP server
// connections, keyed by a stable hash of the server config.
//
// Why a pool?
//   The per-request model (spawn McpClientManager → connectAll → closeAll on
//   every /api/agent call) is simple but slow: even with warm npx/uvx caches,
//   spawning a child process + doing the MCP handshake + listing tools adds
//   ~500ms–2s per server per request. With 7 servers, that's 3–14s of pure
//   overhead per agent turn.
//
//   The pool keeps each server's McpClientManager alive across requests for
//   up to `TTL_MS` (default 10 min) of idle time. Acquiring an existing
//   connection is ~0ms; only the very first request after server boot (or
//   after a connection expires) pays the spawn cost.
//
// Safety:
//   - Reference counting: a connection is only evicted when its refcount
//     hits 0 AND it has been idle for > TTL_MS. An in-use connection is
//     never evicted.
//   - Re-validation: every time a connection is acquired, we ping it with
//     a cheap listTools() call wrapped in a 5s timeout. If the ping fails
//     (server crashed, network died, etc.), we drop the connection and
//     transparently create a fresh one.
//   - Reaping: a setInterval sweeper runs every SWEEP_MS to evict idle
//     connections whose TTL has expired. The sweeper is a no-op if the
//     pool is empty.
//   - Config-hash invalidation: if the user edits a server's config
//     (command/args/env/url/headers), the hash changes, so the next
//     acquire() creates a fresh connection with the new config. The old
//     connection is left to expire naturally (or closed immediately if
//     its refcount is 0).
//
// Concurrency:
//   - All operations are guarded by a single mutex (per-key) to prevent
//     two concurrent acquire() calls from spawning duplicate connections
//     for the same config.
//   - The pool itself is process-global (module-level singleton), so it's
//     shared across all in-flight requests in the same Node.js process.

import { McpClientManager } from "./client"
import type { McpServerConfig, McpToolDescriptor } from "./types"
import { mcpServerSlug } from "./types"

const TTL_MS = 10 * 60 * 1000      // 10 minutes of idle time before eviction
const SWEEP_MS = 60 * 1000          // sweep every 60 seconds
const HEALTH_CHECK_TIMEOUT_MS = 5000 // ping timeout for re-validation

interface PoolEntry {
  key: string
  config: McpServerConfig
  manager: McpClientManager
  tools: McpToolDescriptor[]
  errors: { serverName: string; error: string }[]
  refcount: number
  lastUsedAt: number
  createdAt: number
  // Resolves once the initial connectAll has finished. Concurrent acquire()
  // calls await this to avoid spawning duplicate connections.
  readyPromise: Promise<void>
  // Set to true if the connection has been marked as broken (server died,
  // config changed, etc.). Acquire() will skip broken entries and create
  // a fresh one.
  broken: boolean
}

// Process-global pool. Lives for the lifetime of the Node.js process.
// In Next.js dev mode this survives HMR reloads because it's a module-
// level singleton. In production (standalone) it survives for the life
// of the server process.
const pool = new Map<string, PoolEntry>()

// Per-key mutex to prevent two concurrent acquire() calls from spawning
// duplicate connections for the same config.
const keyLocks = new Map<string, Promise<void>>()

let sweepTimer: ReturnType<typeof setInterval> | null = null

// ── Hashing ──────────────────────────────────────────────────────────────

// Stable hash of a single server config. Includes every field that
// affects how the server is spawned/connected — if any of these change,
// the hash changes, and the pool treats it as a new connection.
export function hashServerConfig(cfg: McpServerConfig): string {
  const parts = [
    cfg.transport,
    cfg.command || "",
    JSON.stringify(cfg.args || []),
    JSON.stringify(cfg.env || {}),
    cfg.url || "",
    JSON.stringify(cfg.headers || {}),
    cfg.enabled ? "1" : "0",
  ]
  // Simple, fast, non-crypto hash (djb2). Good enough for cache keys —
  // collisions would only cause two configs to share a connection, which
  // would surface immediately as a wrong-tools bug.
  let h = 5381
  const s = parts.join("|")
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return `mcp_${(h >>> 0).toString(36)}_${mcpServerSlug(cfg.name)}`
}

// Hash of an entire server list — used to detect when the overall config
// has changed (e.g. a server was added or removed, not just edited).
export function hashServerList(servers: McpServerConfig[]): string {
  const enabled = servers.filter((s) => s.enabled)
  return enabled.map(hashServerConfig).sort().join(",")
}

// ── Pool stats (for observability) ───────────────────────────────────────

export interface PoolStats {
  totalEntries: number
  totalTools: number
  entries: Array<{
    key: string
    serverName: string
    refcount: number
    ageMs: number
    idleMs: number
    toolCount: number
    broken: boolean
  }>
}

export function getPoolStats(): PoolStats {
  const now = Date.now()
  const entries: PoolStats["entries"] = []
  let totalTools = 0
  for (const e of pool.values()) {
    entries.push({
      key: e.key,
      serverName: e.config.name,
      refcount: e.refcount,
      ageMs: now - e.createdAt,
      idleMs: now - e.lastUsedAt,
      toolCount: e.tools.length,
      broken: e.broken,
    })
    totalTools += e.tools.length
  }
  return { totalEntries: pool.size, totalTools, entries }
}

// ── Acquire / release ────────────────────────────────────────────────────

export interface AcquiredConnection {
  manager: McpClientManager
  tools: McpToolDescriptor[]
  errors: { serverName: string; error: string }[]
  key: string
  // Must be called exactly once when the caller is done with the
  // connection. Decrements the refcount; the entry stays in the pool
  // for future requests until its TTL expires.
  release: () => void
}

// Acquires a pooled connection for the given list of enabled MCP servers.
// If a healthy connection already exists for the same config hash, it's
// reused; otherwise a fresh McpClientManager is spawned.
//
// The `release()` function on the returned object MUST be called when
// the caller is done (typically in a finally block).
export async function acquireConnection(
  servers: McpServerConfig[]
): Promise<AcquiredConnection> {
  const enabled = servers.filter((s) => s.enabled)
  if (enabled.length === 0) {
    return {
      manager: new McpClientManager(), // no-op manager
      tools: [],
      errors: [],
      key: "empty",
      release: () => {},
    }
  }

  const key = hashServerList(enabled)

  // Per-key mutex: serialize concurrent acquire() calls for the same key
  // so we don't spawn two managers for the same config.
  const prevLock = keyLocks.get(key) || Promise.resolve()
  let resolveLock!: () => void
  const myLock = new Promise<void>((r) => { resolveLock = r })
  keyLocks.set(key, prevLock.then(() => myLock))
  await prevLock

  try {
    // Try to reuse an existing healthy entry
    const existing = pool.get(key)
    if (existing && !existing.broken) {
      // Wait for the initial connectAll to finish (if it's still in flight)
      await existing.readyPromise
      // Re-validate: ping the manager with a cheap listTools call.
      // If it fails, mark as broken and create a fresh one.
      const healthy = await isHealthy(existing)
      if (healthy) {
        existing.refcount++
        existing.lastUsedAt = Date.now()
        return makeAcquired(existing)
      }
      // Unhealthy — evict and recreate
      await safeClose(existing)
      pool.delete(key)
    }

    // Create a new entry
    const entry = await createEntry(key, enabled)
    pool.set(key, entry)
    return makeAcquired(entry)
  } finally {
    resolveLock()
    // Clean up the lock if we're the last holder
    if (keyLocks.get(key) === myLock) {
      keyLocks.delete(key)
    }
  }
}

function makeAcquired(entry: PoolEntry): AcquiredConnection {
  let released = false
  return {
    manager: entry.manager,
    tools: entry.tools,
    errors: entry.errors,
    key: entry.key,
    release: () => {
      if (released) return
      released = true
      entry.refcount = Math.max(0, entry.refcount - 1)
      entry.lastUsedAt = Date.now()
    },
  }
}

async function createEntry(key: string, servers: McpServerConfig[]): Promise<PoolEntry> {
  const manager = new McpClientManager()
  const entry: PoolEntry = {
    key,
    config: servers[0], // representative config for stats; full list is in the hash
    manager,
    tools: [],
    errors: [],
    refcount: 0,
    lastUsedAt: Date.now(),
    createdAt: Date.now(),
    broken: false,
    readyPromise: Promise.resolve(),
  }

  // Kick off connectAll asynchronously; store the promise so concurrent
  // acquire() calls can await it.
  const readyPromise = (async () => {
    try {
      const result = await manager.connectAll(servers)
      entry.tools = result.tools
      entry.errors = result.errors
    } catch (err) {
      // Mark as broken so the next acquire() recreates it
      entry.broken = true
      entry.errors = [{
        serverName: "(all)",
        error: err instanceof Error ? err.message : String(err),
      }]
    }
  })()
  entry.readyPromise = readyPromise
  await readyPromise

  // Ensure the sweeper is running
  ensureSweeper()
  return entry
}

// Health check: pings every connected server via the MCP `ping` method.
// Returns true if at least one server responds (so a single broken server
// doesn't invalidate the entire pool entry).
async function isHealthy(entry: PoolEntry): Promise<boolean> {
  if (entry.broken) return false
  // If still initializing, wait for it
  await entry.readyPromise
  // If the manager has zero tools and zero errors, it means connectAll
  // hasn't run yet — treat as unhealthy.
  if (entry.tools.length === 0 && entry.errors.length === 0) return false
  // If all servers errored on initial connect, treat as unhealthy so we
  // retry on next acquire (the underlying issue may have been transient).
  if (entry.tools.length === 0 && entry.errors.length > 0) return false
  // Ping with a short timeout. If the manager is unresponsive (server
  // crashed, network died), we'll recreate the connection.
  try {
    return await entry.manager.ping(HEALTH_CHECK_TIMEOUT_MS)
  } catch {
    return false
  }
}

// ── Sweeper ──────────────────────────────────────────────────────────────

function ensureSweeper() {
  if (sweepTimer) return
  sweepTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of pool.entries()) {
      // Only evict if not in use AND idle for longer than TTL
      if (entry.refcount === 0 && now - entry.lastUsedAt > TTL_MS) {
        safeClose(entry).catch(() => {})
        pool.delete(key)
      }
    }
    // If the pool is empty, stop the sweeper to save CPU
    if (pool.size === 0 && sweepTimer) {
      clearInterval(sweepTimer)
      sweepTimer = null
    }
  }, SWEEP_MS)
  // Allow the process to exit even if the timer is still running
  if (sweepTimer && typeof sweepTimer.unref === "function") {
    sweepTimer.unref()
  }
}

// ── Manual invalidation ──────────────────────────────────────────────────

// Evicts a specific entry from the pool. Called when a server's config
// is edited (so the next acquire() spawns a fresh connection with the
// new config) or when the user explicitly disconnects.
export async function evictConnection(key: string): Promise<void> {
  const entry = pool.get(key)
  if (!entry) return
  // Don't close in-use connections — just mark them as broken so they'll
  // be evicted when the current caller releases them.
  if (entry.refcount > 0) {
    entry.broken = true
    return
  }
  await safeClose(entry)
  pool.delete(key)
}

// Evicts all entries. Called when the user clicks "Reset" in the config
// dialog or when the server is shutting down.
export async function evictAll(): Promise<void> {
  const entries = Array.from(pool.values())
  pool.clear()
  await Promise.allSettled(entries.map((e) => safeClose(e)))
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function safeClose(entry: PoolEntry): Promise<void> {
  try {
    await entry.manager.closeAll()
  } catch {
    // ignore — the manager is already broken
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`MCP pool ${label} timed out after ${ms}ms`))
    }, ms)
    p.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (err) => { clearTimeout(timer); reject(err) }
    )
  })
}
