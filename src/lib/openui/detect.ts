/**
 * Cheap heuristic detector for OpenUI Lang content.
 *
 * Used by `agent-message.tsx` to decide whether to mount
 * `<OpenUIAnswerRenderer>` (Pattern B) or the existing Markdown renderer.
 *
 * OpenUI Lang always opens with a PascalCase component call:
 *
 *     Metric("Open issues", "12") { ... }
 *
 * Or contains action statements prefixed with `@`:
 *
 *     @Run get_weather { location: "Tokyo" }
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

// `name:` at the start of a call argument, followed by something that can begin a value.
const NAMED_ARGUMENT = /(\s*)[A-Za-z_][A-Za-z0-9_]*\s*:\s*(?=[\[{"'\d\-a-zA-Z])/y

/**
 * Rewrites named call arguments (`Stack(gap: "md", children: [...])`), which some
 * models emit, into the positional syntax OpenUI Lang requires (`Stack("md", [...])`).
 *
 * Only names in call-argument position are stripped. Keys of object literals
 * (`{name: "Requests", values: [1, 2]}`) and text inside strings are left alone.
 */
export function normalizeOpenUILang(input: string | undefined | null): string {
  if (!input) return ""
  let output = ""
  const openBrackets: string[] = []
  let quote: string | null = null
  let atArgumentStart = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quote) {
      output += char
      if (char === "\\") output += input[++i] ?? ""
      else if (char === quote) quote = null
      continue
    }
    if (atArgumentStart) {
      NAMED_ARGUMENT.lastIndex = i
      const named = NAMED_ARGUMENT.exec(input)
      if (named) {
        output += named[1]
        i += named[0].length - 1
        atArgumentStart = false
        continue
      }
    }
    if (char === '"' || char === "'") quote = char
    if (char === "(" || char === "[" || char === "{") openBrackets.push(char)
    else if (char === ")" || char === "]" || char === "}") openBrackets.pop()
    const insideCall = openBrackets[openBrackets.length - 1] === "("
    atArgumentStart = insideCall && (char === "(" || char === "," || (atArgumentStart && /\s/.test(char)))
    output += char
  }
  return output
}
