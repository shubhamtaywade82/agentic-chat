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

import React, { Component, useMemo, type ReactNode } from "react"
import { Renderer } from "@openuidev/react-lang"
import type { McpServerConfig } from "@/lib/agent-types"
import { useAgentStore } from "@/store/agent-store"
import { buildToolProvider } from "@/lib/openui/tool-provider"
import { domainLibrary } from "@/lib/openui/library"
import { normalizeOpenUILang } from "@/lib/openui/detect"
import { Markdown } from "@/components/agent-chat/markdown"

interface ErrorBoundaryProps {
  children: ReactNode
  fallbackContent: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

class OpenUIErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    if (typeof console !== "undefined") {
      console.warn("[openui] renderer runtime error, falling back to markdown:", error)
    }
  }

  render() {
    if (this.state.hasError) {
      return <Markdown content={this.props.fallbackContent} />
    }
    return this.props.children
  }
}

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

  // Normalize model output (e.g. named arguments with colons) into positional syntax
  const normalizedContent = useMemo(() => normalizeOpenUILang(content), [content])

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
    <OpenUIErrorBoundary fallbackContent={content}>
      <Renderer
        response={normalizedContent}
        library={domainLibrary}
        isStreaming={isStreaming}
        toolProvider={toolProvider}
        onError={handleError}
      />
    </OpenUIErrorBoundary>
  )
}

export default OpenUIAnswerRenderer
