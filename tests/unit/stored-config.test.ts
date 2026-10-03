import { describe, expect, it } from "vitest"
import { migrateStoredConfig } from "@/lib/stored-config"

const legacy = JSON.stringify({
  provider: "openai",
  apiKey: "sk-SECRET",
  apiKeys: [{ key: "sk-SECRET-2" }],
  dhan: { token: "dhan-SECRET" },
  binance: { apiKey: "b-SECRET", apiSecret: "b-SECRET-2" },
  openuiEnabled: true,
})

describe("migrateStoredConfig", () => {
  it("should default to auto for a browser with nothing stored", () => {
    expect(migrateStoredConfig(null)).toEqual({ config: { presentation: "auto" }, rewrite: false })
  })

  it("should drop credentials from an old config and ask for the stored copy to be rewritten", () => {
    const { config, rewrite } = migrateStoredConfig(legacy)

    expect(JSON.stringify(config)).not.toContain("SECRET")
    expect(config).toEqual({ presentation: "auto" })
    expect(rewrite).toBe(true)
  })

  it.each([
    [true, "auto"],
    [false, "markdown"],
  ])("should map the old openuiEnabled=%s to %s", (openuiEnabled, expected) => {
    expect(migrateStoredConfig(JSON.stringify({ openuiEnabled })).config.presentation).toBe(expected)
  })

  it("should keep a valid presentation and leave an already-clean config alone", () => {
    expect(migrateStoredConfig('{"presentation":"openui"}')).toEqual({ config: { presentation: "openui" }, rewrite: false })
  })

  it("should ignore an unknown presentation value", () => {
    expect(migrateStoredConfig('{"presentation":"holographic"}').config.presentation).toBe("auto")
  })

  it("should recover from corrupt storage", () => {
    expect(migrateStoredConfig("{not json")).toEqual({ config: { presentation: "auto" }, rewrite: true })
  })
})
