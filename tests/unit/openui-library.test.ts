import { readFileSync } from "node:fs"
import { createParser, type LibraryJSONSchema } from "@openuidev/lang-core"
import { describe, expect, it } from "vitest"
import { OPENUI_PRESETS } from "@/components/openui-playground/presets"
import { OPENUI_SCHEMA_VERSION, buildNexumOpenUIOffer } from "@/lib/openui/prompt"
import { componentSpecs, domainLibrarySpec } from "@/lib/openui/spec"

const schema = domainLibrarySpec.toJSONSchema() as LibraryJSONSchema

describe("OpenUI component library", () => {
  it.each(OPENUI_PRESETS)("should accept the $name preset against its own schema", ({ code }) => {
    const { root, meta } = createParser(schema).parse(code)

    expect(root).not.toBeNull()
    expect(meta.incomplete).toBe(false)
    expect([meta.errors, meta.unresolved, meta.orphaned]).toEqual([[], [], []])
  })

  it("should reject a component the library does not define", () => {
    const { meta } = createParser(schema).parse('root = Stack("md", [BinancePriceCard("BTCUSDT")])')

    expect(meta.errors.map((e) => e.code)).toContain("unknown-component")
  })

  it("should describe every component in the offer sent to Nexum and nothing from the old trading set", () => {
    const { spec } = buildNexumOpenUIOffer()

    for (const name of Object.keys(componentSpecs)) expect(spec).toContain(name)
    for (const old of ["Binance", "OrderBook", "TradeSetup", "FundingRate", "RiskCalculator", "StatBlock", "HtmlArtifact"]) {
      expect(spec).not.toContain(old)
    }
  })

  it("should declare the OpenUI version of the installed parser, so Nexum accepts the offer", () => {
    const installed = JSON.parse(readFileSync("node_modules/@openuidev/lang-core/package.json", "utf8")).version

    expect(OPENUI_SCHEMA_VERSION).toBe(installed)
  })
})
