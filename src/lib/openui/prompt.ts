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
// IMPORTANT: import the server-safe SPEC, not the React library. `prompt.ts`
// is imported by the server-side `/api/agent` route handler, so it must NOT
// pull in React or `@openuidev/react-lang`. The spec-only stubs in `spec.ts`
// produce the same JSON schema + prompt spec as the React library, but
// without any client-side runtime code.
import { domainLibrarySpec } from "./spec"

// Component-usage rules that hold for any agent runtime, local or Nexum.
const COMPONENT_RULES = [
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
]

function generateComponentSpec(promptOptions: { preamble?: string; additionalRules: string[] }): string {
  // `toSpec()` returns the serializable PromptSpec (components, root, groups)
  // that `generateSystemPrompt` accepts as `library`. We additionally attach
  // the JSON schema (used by the parser at runtime for prop validation).
  const spec = domainLibrarySpec.toSpec()
  return generateSystemPrompt({
    cloud: false,
    library: {
      id: spec.id,
      root: spec.root,
      components: spec.components,
      componentGroups: spec.componentGroups,
      schema: domainLibrarySpec.toJSONSchema(),
    },
    promptOptions,
  })
}

/**
 * Component spec sent to Nexum with `outputFormat: "openui"`. No preamble:
 * Nexum's presentation policy decides when UI is warranted, so the local
 * "always answer in OpenUI" and ReAct-format rules don't apply there.
 */
export function buildNexumOpenUISpec(): string {
  return generateComponentSpec({ additionalRules: COMPONENT_RULES })
}
