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
 * This file is a SKETCH — uncomment after `npm install @openuidev/react-lang`.
 * The activation wiring lives in `src/components/agent-chat/agent-message.tsx`
 * (branch the answer-step render on `looksLikeOpenUILang(content)`).
 */

import type { McpServerConfig } from "@/lib/agent-types"
import { useAgentStore } from "@/store/agent-store"
import { buildToolProvider } from "@/lib/openui/tool-provider"
import { domainLibrary } from "@/lib/openui/library"

// import { Renderer, type OpenUIError } from "@openuidev/react-lang"

export interface OpenUIAnswerRendererProps {
  /** The streaming or final answer text (OpenUI Lang). */
  content: string
  /** True while the SSE stream is still pushing tokens. */
  isStreaming: boolean
  /** MCP server config — used to bridge MCP tools into the renderer. */
  mcpServerConfig: McpServerConfig[]
}

/**
 * Wraps OpenUI's `<Renderer>` with our domain library and tool provider.
 *
 * The tool provider bridges to:
 *   - `executeLiveTool` for built-in tools (binance_*, dhan_*, calculator, …)
 *   - `McpClientManager` (pooled) for MCP tools (`mcp__*`)
 *
 * Both are reused from the existing ReAct loop, so a generated button can
 * invoke the same tools the agent already uses — no duplicate code paths.
 */
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

  const handleError = (_errors: unknown) => {
    // OpenUI surfaces parse errors here. We log them; the renderer itself
    // renders a `MarkdownFallback` card for unknown roots, so the user
    // still sees *something*.
    // console.warn("[openui]", errors)
  }

  /*
  return (
    <Renderer
      response={content}
      library={domainLibrary}
      isStreaming={isStreaming}
      toolProvider={toolProvider}
      onError={handleError}
    />
  )
  */

  // Until `@openuidev/react-lang` is installed, render the raw text in a
  // <pre> so it's at least visible during the spike.
  return (
    <pre
      className="whitespace-pre-wrap rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 font-mono text-xs"
      data-openui-spike
    >
      <div className="mb-2 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
        OpenUI Lang (spike — renderer not yet wired)
      </div>
      {content}
    </pre>
  )
}

export default OpenUIAnswerRenderer
