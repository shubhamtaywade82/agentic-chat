/**
 * Bridges agentic-chat's tool layer into OpenUI's `toolProvider` prop.
 *
 * `<Renderer toolProvider={...}>` accepts either:
 *   - a `Record<string, (args) => Promise<unknown>>` function map, OR
 *   - any `McpClientLike` (duck-typed: has `callTool(name, args)`).
 *
 * We use the function-map form so we can route built-in tools (Binance,
 * Dhan, calculator, …) via `executeLiveTool` and MCP tools via the pooled
 * `McpClientManager` from the same surface. Generated components can then
 * call tools at runtime via OpenUI Lang's `Query()` / `Mutation()`:
 *
 *     Button(onClick: @Run binance_price { symbol: "BTCUSDT" })
 *
 * See docs/openui-integration.md §5.4 (Pattern D).
 *
 * This file is a SKETCH — it type-checks against existing modules today
 * but is not yet wired into `<Renderer>`. To activate, pass the result of
 * `buildToolProvider(...)` as the `toolProvider` prop in
 * `src/components/agent-chat/openui-answer.tsx`.
 */

import type {
  BinanceConfig,
  CustomTool,
  DhanConfig,
  McpServerConfig,
} from "@/lib/agent-types"
import { executeLiveTool } from "@/lib/live-tools"
import { acquireConnection } from "@/lib/mcp/pool"
import { isMcpToolName } from "@/lib/mcp/types"

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
 * Builds the function-map tool provider for OpenUI's `<Renderer>`.
 *
 * Built-in tools are registered by their canonical name (e.g.
 * `binance_price`). MCP tools are routed through a lazy `__mcp` shim that
 * acquires a pooled `McpClientManager` on first call — the pool keeps the
 * connection alive for 10 min idle, so repeated calls during a session
 * are sub-millisecond after the first.
 */
export function buildToolProvider(
  opts: BuildToolProviderOpts
): OpenUIToolProvider {
  const provider: OpenUIToolProvider = {}

  // Built-in live tools.
  for (const name of BUILTIN_TOOL_NAMES) {
    provider[name] = async (args) => {
      const r = await executeLiveTool(
        name,
        args,
        opts.customTools,
        opts.dhan,
        opts.binance
      )
      return r.data
    }
  }

  // Custom tools (user-defined JS / fetch / static JSON tools).
  for (const ct of opts.customTools) {
    if (!ct.enabled) continue
    provider[ct.name] = async (args) => {
      const r = await executeLiveTool(
        ct.name,
        args,
        opts.customTools,
        opts.dhan,
        opts.binance
      )
      return r.data
    }
  }

  // MCP tools — lazy. We don't acquire the pooled connection until a
  // component actually invokes an MCP tool, because the spawn cost is
  // ~500ms–2s per server and we don't want to pay it for every render.
  let mcpConnPromise: ReturnType<typeof acquireConnection> | null = null
  const getMcp = () => {
    if (!mcpConnPromise) {
      mcpConnPromise = acquireConnection(opts.mcpServerConfig)
    }
    return mcpConnPromise
  }

  /**
   * Shim for MCP tool calls. OpenUI Lang's `@Run` action invokes this with
   * `{ tool: "mcp__memory__create_entities", args: {...} }` and we route it
   * to the pooled manager.
   *
   * The signature is widened to `Record<string, unknown>` to match the rest
   * of the function map; the `tool` and `args` fields are read off at runtime.
   *
   * NOTE: this assumes the component author writes the full MCP tool name
   * (`mcp__<server>__<tool>`). For LLM-generated components, we should
   * also register every discovered MCP tool name as a top-level key so
   * `Query("mcp__memory__create_entities", {...})` works directly. That
   * discovery happens inside `agent/route.ts` and is out of scope for
   * this sketch.
   */
  provider.__mcp = async (args: Record<string, unknown>) => {
    const toolName = String(args.tool ?? "")
    const toolArgs = (args.args as Record<string, unknown>) ?? {}
    if (!isMcpToolName(toolName)) {
      throw new Error(`Not an MCP tool name: ${toolName}`)
    }
    const conn = await getMcp()
    const r = await conn.manager.callTool(toolName, toolArgs)
    return r.data
  }

  return provider
}

export default buildToolProvider
