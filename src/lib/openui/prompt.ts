/**
 * Builds the OpenUI component spec that agentic-chat offers to Nexum.
 *
 * `generateSystemPrompt` from `@openuidev/lang-core` is framework-agnostic (no
 * React import), so it is safe to call inside the `/api/agent` route handler.
 * We use `cloud: false` (self-hosted): no THESYS_API_KEY is needed.
 *
 * See docs/openui-integration.md.
 */

import { generateSystemPrompt } from "@openuidev/lang-core"
// IMPORTANT: import the server-safe SPEC, not the React library. `prompt.ts`
// is imported by the server-side `/api/agent` route handler, so it must NOT
// pull in React or `@openuidev/react-lang`. The spec-only stubs in `spec.ts`
// produce the same JSON schema + prompt spec as the React library, but
// without any client-side runtime code.
import { domainLibrarySpec } from "./spec"

// Component-usage rules, sent along with the component spec.
const COMPONENT_RULES = [
  "Arguments are strictly positional: write `Stack(\"md\", [items])`, NOT `Stack(gap: \"md\", children: [items])`. Never use parameter names with colons.",
  "Start with `root = Stack(...)` and put every other component inside it.",
  "Use Table instead of a Markdown table, Chart for numeric series, and Alert for warnings or errors.",
  "Put a few key numbers side by side with `Grid(3, [Metric(...), Metric(...), Metric(...)])`.",
  "Use Card to group related content under a title, and Markdown for prose that no other component fits.",
  "Use HtmlArtifact only for a one-off visual none of the other components can express; never put raw <script> or <style> outside it.",
]

function generateComponentSpec(additionalRules: string[]): string {
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
    promptOptions: { additionalRules },
  })
}

/**
 * The component spec sent to Nexum with `outputFormat: "openui"`. There is no
 * "always answer in OpenUI" preamble: Nexum's presentation policy decides when
 * UI fits the answer and falls back to Markdown otherwise.
 */
export function buildNexumOpenUISpec(): string {
  return generateComponentSpec(COMPONENT_RULES)
}
