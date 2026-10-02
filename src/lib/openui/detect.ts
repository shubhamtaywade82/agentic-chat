/**
 * Cheap heuristic detector for OpenUI Lang content.
 *
 * Used by `agent-message.tsx` to decide whether to mount
 * `<OpenUIAnswerRenderer>` (Pattern B) or the existing Markdown renderer.
 *
 * OpenUI Lang always opens with a PascalCase component call:
 *
 *     BinancePriceCard(symbol: "BTCUSDT", price: 67000.5) { ... }
 *
 * Or contains action statements prefixed with `@`:
 *
 *     @Run binance_price { symbol: "BTCUSDT" }
 *     @Set state.field = "value"
 *
 * Or `Query(...)` / `Mutation(...)` calls for runtime tool invocation.
 *
 * We don't need the full parser here — just enough to disambiguate from
 * Markdown. False positives are fine (the renderer will surface a parse
 * error via `onError`); false negatives just fall through to Markdown,
 * which is always safe.
 */
export function looksLikeOpenUILang(s: string | undefined | null): boolean {
  if (!s || s.length < 4) return false

  // PascalCase component call at the start (e.g. Stack(...))
  if (/^\s*[A-Z][A-Za-z0-9_]*\s*\(/.test(s)) return true

  // OpenUI Lang assignment at the start (e.g. root = Stack(...) or comp = Text(...))
  if (/^\s*(root|[a-z_][a-z0-9_]*)\s*=\s*[A-Z][A-Za-z0-9_]*\s*\(/.test(s)) return true

  // OpenUI Lang action statements anywhere in the body.
  if (/@(Run|Set|Reset|ToAssistant|OpenUrl)\b/.test(s)) return true

  // Runtime tool queries / mutations.
  if (/\bQuery\s*\(/.test(s)) return true
  if (/\bMutation\s*\(/.test(s)) return true

  return false
}

/**
 * Patterns that indicate the query benefits from OpenUI Generative UI components
 * (crypto prices, order books, trade setups, funding rates, risk calculations, or UI cards).
 */
const OPENUI_INTENT_PATTERN =
  /\b(price|ticker|order\s*book|depth|bid|ask|funding\s*rate|funding|trade\s*setup|setup|smc|ict|position\s*size|risk\s*calc|notional|margin|binance|dhan|btc|eth|sol|crypto|kpi|stat\s*block|card|cards|dashboard|widget|openui)\b/i

/**
 * Checks whether OpenUI system prompt augmentation should be activated for a query.
 * Activates when the user query asks for market/trading data or graphical UI components.
 * For general knowledge, coding, or text explanations, returns false so the LLM emits natural Markdown.
 */
export function shouldActivateOpenUI(query: string | undefined | null): boolean {
  if (!query) return false
  return OPENUI_INTENT_PATTERN.test(query)
}

/**
 * Normalizes OpenUI Lang output from models that emit named arguments with
 * colons (e.g. `Stack(gap: "md", children: [...])`) into the strict positional
 * syntax required by OpenUI Lang (`Stack("md", [...])`).
 */
export function normalizeOpenUILang(input: string | undefined | null): string {
  if (!input) return ""
  return input.replace(
    /([,(]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(?=[\[{"'\d\-a-zA-Z])/g,
    "$1"
  )
}
