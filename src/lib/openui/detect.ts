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
