/**
 * Bridges agentic-chat's tool layer into OpenUI's `toolProvider` prop.
 *
 * `<Renderer toolProvider={...}>` accepts either:
 *   - a `Record<string, (args) => Promise<unknown>>` function map, OR
 *   - any `McpClientLike` (duck-typed: has `callTool(name, args)`).
 *
 * We use the function-map form. Each entry POSTs to `/api/tool` (server-side
 * route at `src/app/api/tool/route.ts`) which calls `executeLiveTool` or the
 * pooled `McpClientManager`. This keeps server-only credentials (Dhan tokens,
 * Binance API keys) and Node-only modules (`@shubhamtaywade82/dhanhq-ts`
 * needs `readline`) off the client bundle.
 *
 * Generated components can then call tools at runtime via OpenUI Lang's
 * `Query()` / `Mutation()`:
 *
 *     Button(onClick: @Run binance_price { symbol: "BTCUSDT" })
 *
 * See docs/openui-integration.md §5.4 (Pattern D).
 */

import type {
  BinanceConfig,
  CustomTool,
  DhanConfig,
  McpServerConfig,
} from "@/lib/agent-types"

/**
 * Names of built-in tools we expose to OpenUI-rendered components. Keep
 * this in sync with `AVAILABLE_TOOLS` in `src/lib/agent-types.ts`.
 */
const BUILTIN_TOOL_NAMES = [
  // General
  "calculator",
  "weather_api",
  "web_search",
  "code_interpreter",
  // Binance USD-M
  "binance_price",
  "binance_24hr_ticker",
  "binance_klines",
  "binance_order_book",
  "binance_funding_rate",
  "binance_open_interest",
  "binance_long_short_ratio",
  // Prop trading
  "prop_scan_setups",
  "prop_evaluate_pair",
  "prop_risk_calculator",
  // DhanHQ Indian markets
  "dhan_ltp",
  "dhan_quote",
  "dhan_holdings",
  "dhan_positions",
  "dhan_funds",
  "dhan_option_chain",
  "dhan_market_summary",
] as const

export interface BuildToolProviderOpts {
  customTools: CustomTool[]
  dhan?: DhanConfig
  binance?: BinanceConfig
  mcpServerConfig: McpServerConfig[]
}

export type OpenUIToolProvider = Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
>

/**
 * Single client-side function that POSTs a tool invocation to /api/tool.
 * The server route handles `executeLiveTool` (built-in + custom) and MCP
 * routing via the pooled `McpClientManager`.
 */
async function callToolServerSide(
  tool: string,
  args: Record<string, unknown>,
  config: BuildToolProviderOpts
): Promise<unknown> {
  const res = await fetch("/api/tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool,
      args,
      config: {
        customTools: config.customTools,
        dhan: config.dhan,
        binance: config.binance,
        mcpServers: config.mcpServerConfig,
      },
    }),
  })
  const json = (await res.json()) as { ok: boolean; data?: unknown; error?: string }
  if (!json.ok) {
    throw new Error(json.error || `Tool ${tool} failed`)
  }
  return json.data
}

/**
 * Builds the function-map tool provider for OpenUI's `<Renderer>`.
 *
 * Built-in tools are registered by their canonical name (e.g.
 * `binance_price`). Custom tools are registered by their user-defined name.
 * MCP tools (`mcp__<server>__<tool>`) are routed through a single `__mcp`
 * shim that the renderer can invoke via `Query("__mcp", { tool, args })` —
 * but LLM-generated components typically call MCP tools directly by their
 * full name, which we also register.
 *
 * Each call POSTs to `/api/tool`; the server route handles execution in
 * the Node.js runtime (where `dhanhq-ts` and MCP stdio servers work).
 */
export function buildToolProvider(
  opts: BuildToolProviderOpts
): OpenUIToolProvider {
  const provider: OpenUIToolProvider = {}

  // Built-in live tools.
  for (const name of BUILTIN_TOOL_NAMES) {
    provider[name] = (args) => callToolServerSide(name, args, opts)
  }

  // Custom tools (user-defined JS / fetch / static JSON tools).
  for (const ct of opts.customTools) {
    if (!ct.enabled) continue
    provider[ct.name] = (args) => callToolServerSide(ct.name, args, opts)
  }

  /**
   * Catch-all MCP shim. OpenUI Lang's `@Run` action invokes tools by name;
   * if the renderer encounters a tool name we didn't pre-register (e.g. a
   * dynamically-discovered MCP tool), it falls through to this shim with
   * `{ tool, args }` payload. The server route detects MCP-prefixed names
   * and routes through the pooled McpClientManager.
   */
  provider.__mcp = async (args: Record<string, unknown>) => {
    const toolName = String(args.tool ?? "")
    const toolArgs = (args.args as Record<string, unknown>) ?? {}
    return callToolServerSide(toolName, toolArgs, opts)
  }

  return provider
}

export default buildToolProvider
