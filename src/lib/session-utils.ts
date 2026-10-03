import type { ChatSession } from "./agent-types"

export function searchSessions(sessions: ChatSession[], query: string): ChatSession[] {
  const q = query.toLowerCase().trim()
  if (!q) return sessions

  return sessions.filter((s) => {
    if (s.title.toLowerCase().includes(q)) return true
    return s.messages.some((m) => {
      if (m.content?.toLowerCase().includes(q)) return true
      if (m.query?.toLowerCase().includes(q)) return true
      return m.trace?.some((t) => {
        if (t.kind === "answer" && t.content.toLowerCase().includes(q)) return true
        if (t.kind === "tool_call" && (t.toolName.toLowerCase().includes(q) || JSON.stringify(t.args).toLowerCase().includes(q))) return true
        return false
      })
    })
  })
}

// Generate a concise, relevant title for a chat session from user prompt
export function generateSessionTitle(prompt: string): string {
  if (!prompt || !prompt.trim()) return "New Chat"

  let clean = prompt.trim()

  // Remove common conversational preamble prefixes
  const prefixRegex = /^(can\s+you\s+(please\s+)?|please\s+|what\s+(is|are)\s+(the\s+)?|how\s+to\s+|show\s+me\s+(the\s+)?|tell\s+me\s+about\s+|help\s+me\s+(with\s+)?|give\s+me\s+(the\s+)?|analyze\s+(the\s+)?|calculate\s+(the\s+)?|explain\s+(the\s+)?|check\s+(the\s+)?|find\s+(the\s+)?|get\s+(the\s+)?)/i
  clean = clean.replace(prefixRegex, "")

  // Remove markdown formatting and punctuation from edges
  clean = clean.replace(/^[`"'#*\s]+|[`"'#*!?. \t\n\r]+$/g, "")

  if (!clean) {
    clean = prompt.trim().slice(0, 32)
  }

  // Capitalize first character
  clean = clean.charAt(0).toUpperCase() + clean.slice(1)

  // Truncate cleanly at word boundary
  if (clean.length > 36) {
    const truncated = clean.slice(0, 34)
    const lastSpace = truncated.lastIndexOf(" ")
    clean = (lastSpace > 16 ? truncated.slice(0, lastSpace) : truncated) + "..."
  }

  return clean || "New Chat"
}
