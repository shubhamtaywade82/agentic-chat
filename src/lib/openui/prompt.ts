/**
 * OpenUI system-prompt builder (Pattern B — self-hosted).
 *
 * When `openuiEnabled` is true on the agent config, the system prompt is
 * augmented with the auto-generated OpenUI component spec so the LLM
 * knows which components it can emit. We use `cloud: false` (self-hosted)
 * so this works with ANY provider — OpenAI, Anthropic, Groq, Ollama, etc.
 * — without requiring a `THESYS_API_KEY`.
 *
 * `generateSystemPrompt` from `@openuidev/lang-core` is framework-agnostic
 * (no React import), so it's safe to call server-side inside the
 * `/api/agent` route handler.
 *
 * See docs/openui-integration.md §6.
 */

import { generateSystemPrompt } from "@openuidev/lang-core"
import type {
  AgentMemoryItem,
  CustomTool,
} from "@/lib/agent-types"
import type { McpToolDescriptor } from "@/lib/mcp/types"
import { getToolSystemPrompt } from "@/lib/live-tools"
import { formatMemoriesForPrompt } from "@/lib/memory-engine"
// IMPORTANT: import the server-safe SPEC, not the React library. `prompt.ts`
// is imported by the server-side `/api/agent` route handler, so it must NOT
// pull in React or `@openuidev/react-lang`. The spec-only stubs in `spec.ts`
// produce the same JSON schema + prompt spec as the React library, but
// without any client-side runtime code.
import { domainLibrarySpec } from "./spec"

export interface BuildOpenUISystemPromptOpts {
  baseSystemPrompt: string
  memories: AgentMemoryItem[]
  query: string
  enabledTools: Record<string, boolean>
  customTools: CustomTool[]
  mcpTools: McpToolDescriptor[]
}

/**
 * Builds the augmented system prompt used when `openuiEnabled === true`.
 *
 * Layers:
 *   1. The agent's base ReAct system prompt (Plan/Thought/Action/Observation).
 *   2. OpenUI component spec (auto-generated from `domainLibrary`).
 *   3. The tool catalog (built-in + custom + MCP).
 *   4. Ranked long-term memories.
 *   5. A short instruction to prefer components over Markdown tables.
 *
 * We use `cloud: false` so no `THESYS_API_KEY` is required. The trade-off
 * is that without the Gateway's mid-stream autofix, ~10–20% of responses
 * from smaller models (especially local Ollama) may be malformed OpenUI
 * Lang. The client-side `looksLikeOpenUILang` detector + Markdown
 * fallback in `agent-message.tsx` handles this gracefully.
 */
export function buildOpenUISystemPrompt(
  opts: BuildOpenUISystemPromptOpts
): string {
  // `toSpec()` returns the serializable PromptSpec (components, root, groups)
  // that `generateSystemPrompt` accepts as `library`. We additionally attach
  // the JSON schema (used by the parser at runtime for prop validation).
  const spec = domainLibrarySpec.toSpec()
  const componentSpec = generateSystemPrompt({
    cloud: false,
    library: {
      id: spec.id,
      root: spec.root,
      components: spec.components,
      componentGroups: spec.componentGroups,
      schema: domainLibrarySpec.toJSONSchema(),
    },
    promptOptions: {
      preamble:
        "You are rendering the Final Answer as a generative UI. Always " +
        "wrap your response in a single `Stack` root component containing " +
        "the domain components below. Use MarkdownFallback for any text " +
        "that doesn't fit a domain component — never emit raw Markdown at " +
        "the top level.",
      additionalRules: [
        "ALWAYS start your Final Answer with `root = Stack(...)` — never with raw text or Markdown.",
        "Arguments are strictly positional: write `Stack(\"md\", [items])`, NOT `Stack(gap: \"md\", children: [items])`. Never use parameter names with colons.",
        "Prefer BinancePriceCard over a Markdown table for a single price.",
        "Prefer OrderBookTable when showing depth.",
        "Prefer TradeSetupCard for any prop_scan_setups or prop_evaluate_pair result.",
        "Prefer FundingRateCard for binance_funding_rate results.",
        "Prefer RiskCalculatorCard for prop_risk_calculator results.",
        "Use multiple StatBlock tiles in a Stack for a quick-metrics summary.",
        "For plain text/explanations with no domain component fit, use MarkdownFallback(\"...\"). " +
          "For a genuinely custom visual (e.g. a one-off chart or diagram) no domain component " +
          "covers, use HtmlArtifact instead — never inline raw <script>/<style> outside it.",
        "Continue to emit Plan/Thought/Action/Action Input as plain text during the ReAct loop — only the Final Answer uses OpenUI Lang.",
      ],
    },
  })

  const toolBlock = getToolSystemPrompt(
    opts.enabledTools,
    opts.customTools,
    opts.mcpTools
  )
  const memoryBlock = formatMemoriesForPrompt(opts.memories, opts.query)

  return [
    opts.baseSystemPrompt,
    "",
    "══════ OPENUI GENERATIVE-UI SPEC ══════",
    componentSpec,
    "══════ END OPENUI SPEC ══════",
    "",
    toolBlock,
    memoryBlock,
  ].join("\n")
}

export default buildOpenUISystemPrompt
