"use client"

/**
 * OpenUI `<Renderer>` wrapper for the agent's final-answer bubble.
 *
 * Pattern B from docs/openui-integration.md §3. When the answer content
 * looks like OpenUI Lang (detected via `looksLikeOpenUILang`), mount this
 * component instead of the existing Markdown renderer. It progressively
 * parses the streaming content into a tree of domain components (charts,
 * cards, tables) and renders them live as tokens arrive.
 *
 * The tool provider bridges to:
 *   - `executeLiveTool` for built-in tools (binance_*, dhan_*, calculator, …)
 *   - `McpClientManager` (pooled) for MCP tools (`mcp__*`)
 *
 * Both are reused from the existing ReAct loop, so a generated button can
 * invoke the same tools the agent already uses — no duplicate code paths.
 */

import { Renderer } from "@openuidev/react-lang"
import type { McpServerConfig } from "@/lib/agent-types"
import { useAgentStore } from "@/store/agent-store"
import { buildToolProvider } from "@/lib/openui/tool-provider"
import { domainLibrary } from "@/lib/openui/library"

export interface OpenUIAnswerRendererProps {
  /** The streaming or final answer text (OpenUI Lang). */
  content: string
  /** True while the SSE stream is still pushing tokens. */
  isStreaming: boolean
  /** MCP server config — used to bridge MCP tools into the renderer. */
  mcpServerConfig: McpServerConfig[]
}

export function OpenUIAnswerRenderer({
  content,
  isStreaming,
  mcpServerConfig,
}: OpenUIAnswerRendererProps) {
  const config = useAgentStore((s) => s.config)

  const toolProvider = buildToolProvider({
    customTools: config.customTools,
    dhan: config.dhan,
    binance: config.binance,
    mcpServerConfig,
  })

  const handleError = (errors: unknown) => {
    // OpenUI surfaces parse errors here. The renderer itself renders a
    // `MarkdownFallback` card for unknown roots, so the user still sees
    // *something*. We log at debug level only — partial parses are normal
    // during streaming.
    if (typeof console !== "undefined") {
      console.debug("[openui] parse errors", errors)
    }
  }

  return (
    <Renderer
      response={content}
      library={domainLibrary}
      isStreaming={isStreaming}
      toolProvider={toolProvider}
      onError={handleError}
    />
  )
}

export default OpenUIAnswerRenderer
