import { DEFAULT_CONFIG, type AgentConfig } from "./agent-types"
import { PRESENTATION_MODES } from "./presentation"

/**
 * Turns whatever an earlier version left in localStorage into the current config, and says whether the
 * stored copy needs rewriting.
 *
 * Older versions kept provider API keys and Dhan/Binance credentials here; Nexum owns all of that now, so
 * only the presentation preference is kept and the rewrite deletes the rest. The old `openuiEnabled` flag
 * becomes `presentation`: on means the model may choose UI (`auto`), off keeps Markdown.
 */
export function migrateStoredConfig(saved: string | null): { config: AgentConfig; rewrite: boolean } {
  if (!saved) return { config: { ...DEFAULT_CONFIG }, rewrite: false }

  let stored: Record<string, unknown>
  try {
    stored = JSON.parse(saved) as Record<string, unknown>
  } catch {
    return { config: { ...DEFAULT_CONFIG }, rewrite: true }
  }

  const config: AgentConfig = { presentation: presentationOf(stored) }
  return { config, rewrite: saved !== JSON.stringify(config) }
}

function presentationOf(stored: Record<string, unknown>): AgentConfig["presentation"] {
  const mode = PRESENTATION_MODES.find((m) => m === stored.presentation)
  if (mode) return mode
  if (stored.openuiEnabled === true) return "auto"
  if (stored.openuiEnabled === false) return "markdown"
  return DEFAULT_CONFIG.presentation
}
