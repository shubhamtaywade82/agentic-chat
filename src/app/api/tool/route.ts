import { NextRequest, NextResponse } from "next/server"
import { executeLiveTool } from "@/lib/live-tools"
import type {
  AgentConfig,
  BinanceConfig,
  CustomTool,
  DhanConfig,
} from "@/lib/agent-types"
import { acquireConnection } from "@/lib/mcp/pool"
import { isMcpToolName } from "@/lib/mcp/types"

/**
 * Server-side tool execution endpoint for OpenUI-rendered components.
 *
 * When an OpenUI Lang component calls `Query("binance_price", { symbol: "BTCUSDT" })`
 * or fires an `@Run` action, the client-side `toolProvider` (see
 * `src/lib/openui/tool-provider.ts`) POSTs the call here instead of
 * executing it in the browser. This keeps server-only credentials (Dhan
 * tokens, Binance API keys) and Node-only modules (`@shubhamtaywade82/dhanhq-ts`
 * needs `readline`) off the client.
 *
 * Body: `{ tool: string, args: Record<string, unknown>, config: AgentConfig }`
 * Response: `{ ok: true, data: unknown } | { ok: false, error: string }`
 *
 * See docs/openui-integration.md §5.4 (Pattern D).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tool: string
      args: Record<string, unknown>
      config: Pick<AgentConfig, "customTools" | "dhan" | "binance" | "mcpServers">
    }

    if (!body.tool || typeof body.tool !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing `tool` field" },
        { status: 400 }
      )
    }

    const args = body.args ?? {}
    const customTools: CustomTool[] = body.config?.customTools ?? []
    const dhan: DhanConfig | undefined = body.config?.dhan
    const binance: BinanceConfig | undefined = body.config?.binance

    // MCP-prefixed tool names route through the pooled McpClientManager.
    if (isMcpToolName(body.tool)) {
      const mcpServers = body.config?.mcpServers ?? []
      const conn = await acquireConnection(mcpServers)
      try {
        const r = await conn.manager.callTool(body.tool, args)
        return NextResponse.json({ ok: true, data: r.data })
      } finally {
        conn.release()
      }
    }

    // Built-in + custom tools go through the existing dispatcher.
    const r = await executeLiveTool(body.tool, args, customTools, dhan, binance)
    if (r.error) {
      return NextResponse.json({ ok: false, error: r.error, data: r.data }, { status: 500 })
    }
    return NextResponse.json({ ok: true, data: r.data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
