import { NextResponse } from "next/server"
import { getPoolStats, evictAll } from "@/lib/mcp/pool"

// GET /api/mcp/pool-stats
// Returns the current state of the MCP connection pool: how many entries are
// cached, how many tools they expose, per-entry refcount / age / idle time.
// Used for observability — e.g. a small status panel in the MCP tab.
export async function GET() {
  const stats = getPoolStats()
  return NextResponse.json({
    ...stats,
    config: {
      ttlMs: 10 * 60 * 1000,
      sweepMs: 60 * 1000,
      healthCheckTimeoutMs: 5000,
    },
    timestamp: Date.now(),
  })
}

// DELETE /api/mcp/pool-stats
// Evicts all entries from the pool. Useful when the user has edited server
// configs and wants to force-reconnect on the next request, or when a
// server has gone unhealthy and the pool is stuck with a broken entry.
export async function DELETE() {
  await evictAll()
  return NextResponse.json({ success: true, message: "Pool evicted" })
}
