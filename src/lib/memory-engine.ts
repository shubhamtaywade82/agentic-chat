import type { AgentMemoryItem, ChatSession } from "./agent-types"

// Default persistent trading and system memories
export const DEFAULT_MEMORIES: AgentMemoryItem[] = [
  {
    id: "mem_crypto_default",
    category: "trading_fact",
    title: "Binance USD-M Symbol Format",
    content: "Binance futures trading pairs must be in uppercase without slashes (e.g. BTCUSDT, SOLUSDT, ETHUSDT).",
    source: "agent_learning",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mem_dhan_default",
    category: "trading_fact",
    title: "DhanHQ Indian Market Security IDs",
    content: "NIFTY 50 index is securityId 13 under segment IDX_I. BANKNIFTY is securityId 25 under IDX_I. Equities belong to NSE_EQ or BSE_EQ.",
    source: "agent_learning",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mem_format_pref",
    category: "preference",
    title: "Tabular Market Data Presentation",
    content: "Format price quotes, funding rates, open interest, and technical levels in clean markdown tables with clear column headers.",
    source: "user",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

// Extract keywords from text for relevance scoring
function getKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

// Compute relevance score between memory and query
function computeRelevance(mem: AgentMemoryItem, queryKeywords: string[]): number {
  if (queryKeywords.length === 0) return 1
  const memWords = new Set(getKeywords(`${mem.title} ${mem.content} ${mem.category}`))
  let matchCount = 0
  for (const q of queryKeywords) {
    if (memWords.has(q)) matchCount += 1
  }
  return matchCount
}

// Formats enabled memories into prompt injection
export function formatMemoriesForPrompt(memories: AgentMemoryItem[] = [], query?: string): string {
  const enabled = memories.filter((m) => m.enabled)
  if (enabled.length === 0) return ""

  const queryKeywords = query ? getKeywords(query) : []

  // Rank memories by relevance if query is provided
  const ranked = [...enabled].sort((a, b) => {
    const scoreB = computeRelevance(b, queryKeywords)
    const scoreA = computeRelevance(a, queryKeywords)
    return scoreB - scoreA
  })

  const topMemories = ranked.slice(0, 8)

  const items = topMemories.map((m) => `- [${m.category.toUpperCase()}] ${m.title}: ${m.content}`)

  return `\n\n## 🧠 PERSISTENT AGENT MEMORY & LEARNED PATTERNS:
${items.join("\n")}
Always adhere to the user preferences, trading facts, and learned corrections listed above.`
}

// Parse `/learn <text>` or natural learning intent
export function parseLearnCommand(text: string): { title: string; content: string; category: AgentMemoryItem["category"] } | null {
  const match = text.match(/^\/learn\s+(.+)$/i) || text.match(/^(?:remember|learn)\s+that\s+(.+)$/i)
  if (!match) return null

  const raw = match[1].trim()
  const isTrading = /\b(binance|dhan|nifty|crypto|leverage|margin|strike|option|ltp|quote|order)\b/i.test(raw)
  const isPref = /\b(prefer|always|never|format|style|language|tone|display)\b/i.test(raw)

  const category = isTrading ? "trading_fact" : isPref ? "preference" : "user_instruction"
  const title = raw.length > 40 ? `${raw.slice(0, 37)}...` : raw

  return {
    title,
    content: raw,
    category,
  }
}

// Search past sessions for semantic keyword matches
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

  // Handle /learn command
  if (clean.startsWith("/learn")) {
    const withoutSlash = clean.replace(/^\/learn\s+/i, "")
    const shortText = withoutSlash.length > 30 ? `${withoutSlash.slice(0, 28)}...` : withoutSlash
    return `Memory: ${shortText}`
  }

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

  return clean || "Trading Chat"
}
