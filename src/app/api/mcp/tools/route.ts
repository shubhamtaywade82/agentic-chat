import { NextRequest, NextResponse } from "next/server"
import { McpClientManager } from "@/lib/mcp/client"
import type { McpServerConfig } from "@/lib/mcp/types"

// POST /api/mcp/tools
// Body: { servers: McpServerConfig[] }
// Returns: { tools: McpToolDescriptor[], errors: { serverName, error }[] }
//
// Spawns/connects to each enabled MCP server in parallel, lists the tools
// each one exposes, and returns the flattened list. Used by the MCP tab in
// the Agent Configuration dialog so the user can see what's available
// without sending a chat message.
//
// Connections are closed immediately after the tool list is gathered —
// the agent route re-spawns them per request (cheap when packages are
// already cached by npx/uvx).
export async function POST(req: NextRequest) {
  try {
    const { servers = [] } = (await req.json()) as { servers?: McpServerConfig[] }
    const enabled = servers.filter((s) => s.enabled)

    if (enabled.length === 0) {
      return NextResponse.json({ tools: [], errors: [] })
    }

    const manager = new McpClientManager()
    try {
      const result = await manager.connectAll(enabled)
      return NextResponse.json({
        tools: result.tools,
        errors: result.errors,
        summary: {
          total: enabled.length,
          connected: enabled.length - result.errors.length,
          failed: result.errors.length,
          toolCount: result.tools.length,
        },
      })
    } finally {
      await manager.closeAll().catch(() => {})
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { tools: [], errors: [{ serverName: "(all)", error: errorMsg }] },
      { status: 500 }
    )
  }
}
