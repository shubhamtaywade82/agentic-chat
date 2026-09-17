/**
 * OpenUI system-prompt builder (Pattern A + B).
 *
 * When the active provider is `openui_gateway`, the system prompt should
 * carry the auto-generated OpenUI component spec so the LLM knows which
 * components it can emit. `@openuidev/lang-core` ships
 * `generateSystemPrompt({ cloud, library, instructions })` for exactly
 * this — it's framework-agnostic (no React import), so it's safe to call
 * server-side inside the `/api/agent` route handler.
 *
 * This file is a SKETCH — uncomment after `npm install @openuidev/lang-core`.
 * See docs/openui-integration.md §6.
 */

import type {
  AgentMemoryItem,
  CustomTool,
} from "@/lib/agent-types"
import type { McpToolDescriptor } from "@/lib/mcp/types"
import { getToolSystemPrompt } from "@/lib/live-tools"
import { formatMemoriesForPrompt } from "@/lib/memory-engine"
import { domainLibrary } from "./library"

// import { generateSystemPrompt } from "@openuidev/lang-core/cloud"

export interface BuildOpenUISystemPromptOpts {
  baseSystemPrompt: string
  memories: AgentMemoryItem[]
  query: string
  enabledTools: Record<string, boolean>
  customTools: CustomTool[]
  mcpTools: McpToolDescriptor[]
}

/**
 * Builds the augmented system prompt used when `provider === "openui_gateway"`.
 *
 * The prompt is layered:
 *   1. OpenUI component spec (auto-generated from `domainLibrary`).
 *   2. The agent's base ReAct system prompt (Plan/Thought/Action/Observation).
 *   3. The tool catalog (built-in + custom + MCP).
 *   4. Ranked long-term memories.
 *   5. A short instruction to prefer components over Markdown tables.
 *
 * Note: `generateSystemPrompt({ cloud: true })` returns the spec that the
 * Gateway's mid-stream validator expects. For self-hosted (non-Gateway)
 * OpenUI Lang generation, pass `cloud: false` instead.
 */
export function buildOpenUISystemPrompt(
  opts: BuildOpenUISystemPromptOpts
): string {
  // const componentSpec = generateSystemPrompt({
  //   cloud: true,
  //   library: domainLibrary,
  //   instructions: opts.baseSystemPrompt,
  // })

  const toolBlock = getToolSystemPrompt(
    opts.enabledTools,
    opts.customTools,
    opts.mcpTools
  )
  const memoryBlock = formatMemoriesForPrompt(opts.memories, opts.query)

  // Until `@openuidev/lang-core` is installed, return the un-augmented
  // prompt so the Gateway call still works (it just won't have the
  // component spec — the model will emit Markdown, which the existing UI
  // renders correctly as a fallback).
  const componentSpec = `[OpenUI component spec will be injected here once @openuidev/lang-core is installed.
See docs/openui-integration.md §6 for the activate steps.]`

  return [
    componentSpec,
    "",
    opts.baseSystemPrompt,
    "",
    toolBlock,
    memoryBlock,
    "",
    "When responding in OpenUI Lang, prefer registered components over " +
      "Markdown tables (e.g. BinancePriceCard for a single price, " +
      "OrderBookTable for depth). Fall back to MarkdownFallback only when " +
      "no domain component fits.",
  ].join("\n")
}

export default buildOpenUISystemPrompt
