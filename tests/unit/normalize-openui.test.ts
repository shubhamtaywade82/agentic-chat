import { describe, expect, it } from "vitest"
import { normalizeOpenUILang } from "@/lib/openui/detect"
import { OPENUI_PRESETS } from "@/components/openui-playground/presets"

describe("normalizeOpenUILang", () => {
  it.each([
    ["named arguments", `Stack(gap: "md", children: [Text(content: "hi", variant: "heading")])`, `Stack("md", [Text("hi", "heading")])`],
    ["arguments split across lines", `Stack(\n  gap: "md",\n  children: []\n)`, `Stack(\n  "md",\n  []\n)`],
    ["a named argument holding an object", `Chart(type: "bar", labels: ["a"], series: [{name: "R", values: [1]}])`, `Chart("bar", ["a"], [{name: "R", values: [1]}])`],
  ])("should rewrite %s as positional", (_name, input, expected) => {
    expect(normalizeOpenUILang(input)).toBe(expected)
  })

  it.each([
    ["object literal keys", `Chart("bar", ["a"], [{name: "R", values: [1, 2]}])`],
    ["an action with several arguments", `@Run get_weather { location: "Tokyo", units: "c" }`],
    ["a colon inside a string", `Text("note: this, a: b", "small")`],
    ["an escaped quote inside a string", `Text("say \\"x: y\\", ok")`],
  ])("should leave %s untouched", (_name, input) => {
    expect(normalizeOpenUILang(input)).toBe(input)
  })

  it("should not change any shipped preset", () => {
    for (const preset of OPENUI_PRESETS) expect(normalizeOpenUILang(preset.code)).toBe(preset.code)
  })

  it("should return an empty string for empty input", () => {
    expect(normalizeOpenUILang(null)).toBe("")
    expect(normalizeOpenUILang("")).toBe("")
  })
})
