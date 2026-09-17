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

  // PascalCase component call at the start (ignoring whitespace).
  if (/^\s*[A-Z][A-Za-z0-9_]*\s*\(/.test(s)) return true

  // OpenUI Lang action statements anywhere in the body.
  if (/@(Run|Set|Reset|ToAssistant|OpenUrl)\b/.test(s)) return true

  // Runtime tool queries / mutations.
  if (/\bQuery\s*\(/.test(s)) return true
  if (/\bMutation\s*\(/.test(s)) return true

  return false
}
