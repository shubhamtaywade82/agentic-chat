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
    expect(migrateStoredConfig(null)).toEqual({ config: { presentation: "auto", approvalMode: "ask", modelTier: "auto" }, rewrite: false })
  })

  it("should drop credentials from an old config and ask for the stored copy to be rewritten", () => {
    const { config, rewrite } = migrateStoredConfig(legacy)

    expect(JSON.stringify(config)).not.toContain("SECRET")
    expect(config).toEqual({ presentation: "auto", approvalMode: "ask", modelTier: "auto" })
    expect(rewrite).toBe(true)
  })

  it.each([
    [true, "auto"],
    [false, "markdown"],
  ])("should map the old openuiEnabled=%s to %s", (openuiEnabled, expected) => {
    expect(migrateStoredConfig(JSON.stringify({ openuiEnabled })).config.presentation).toBe(expected)
  })

  it("should keep a valid presentation and leave an already-clean config alone", () => {
    const clean = '{"presentation":"openui","approvalMode":"auto-edit","modelTier":"primary"}'
    expect(migrateStoredConfig(clean)).toEqual({
      config: { presentation: "openui", approvalMode: "auto-edit", modelTier: "primary" },
      rewrite: false,
    })
  })

  it("should ignore an unknown presentation value", () => {
    expect(migrateStoredConfig('{"presentation":"holographic"}').config.presentation).toBe("auto")
  })

  it("should fall back to ask for an unknown approval mode", () => {
    expect(migrateStoredConfig('{"approvalMode":"everything"}').config.approvalMode).toBe("ask")
  })

  it("should recover from corrupt storage", () => {
    expect(migrateStoredConfig("{not json")).toEqual({ config: { presentation: "auto", approvalMode: "ask", modelTier: "auto" }, rewrite: true })
  })
})
