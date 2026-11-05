import { APPROVAL_MODES, DEFAULT_CONFIG, MODEL_TIERS, type AgentConfig } from "./agent-types"
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

  // YOLO is never restored: like a --yolo flag, it lasts until reload instead of silently carrying over.
  const restorable = APPROVAL_MODES.filter((m) => m !== "yolo")
  const approvalMode = restorable.find((m) => m === stored.approvalMode) ?? DEFAULT_CONFIG.approvalMode
  const modelTier = MODEL_TIERS.find((t) => t === stored.modelTier) ?? DEFAULT_CONFIG.modelTier
  const config: AgentConfig = { presentation: presentationOf(stored), approvalMode, modelTier }
  return { config, rewrite: saved !== JSON.stringify(config) }
}

function presentationOf(stored: Record<string, unknown>): AgentConfig["presentation"] {
  const mode = PRESENTATION_MODES.find((m) => m === stored.presentation)
  if (mode) return mode
  if (stored.openuiEnabled === true) return "auto"
  if (stored.openuiEnabled === false) return "markdown"
  return DEFAULT_CONFIG.presentation
}
