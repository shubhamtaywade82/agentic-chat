import type { NexumCapabilities, PresentationMode } from "@/lib/nexum"

export const PRESENTATION_MODES: readonly PresentationMode[] = ["auto", "markdown", "openui"]

export const PRESENTATION_LABELS: Record<PresentationMode, { label: string; description: string }> = {
  auto: { label: "Auto", description: "Nexum answers with generated UI when the content fits, and Markdown otherwise." },
  markdown: { label: "Markdown", description: "Always plain Markdown." },
  openui: { label: "Generated UI", description: "Ask for generated UI; a malformed answer is shown as Markdown." },
}

/** Whether the connected server can validate and return OpenUI answers. Unknown (not loaded yet) counts as yes. */
export function serverSupportsOpenUI(capabilities: NexumCapabilities | null): boolean {
  return capabilities?.presentations.some((p) => p.format === "openui") ?? true
}
