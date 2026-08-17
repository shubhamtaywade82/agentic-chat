import { NextRequest, NextResponse } from "next/server"
import { resolveBinanceClient } from "@/lib/live-tools"
import type { BinanceConfig } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  try {
    const { symbol, binance } = (await req.json()) as {
      symbol: string
      binance?: BinanceConfig
    }

    if (!symbol) {
      return NextResponse.json({ success: false, error: "symbol is required" }, { status: 400 })
    }

    const client = resolveBinanceClient(binance)
    const cleanSymbol = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

    const [fundingRate, openInterest, longShortRatio] = await Promise.all([
      client.futures.data.fundingRateHistory(cleanSymbol, { limit: 5 }),
      client.futures.data.openInterest(cleanSymbol),
      client.futures.data.globalLongShortAccountRatio(cleanSymbol, "1h", 5),
    ])

    return NextResponse.json({ success: true, data: { fundingRate, openInterest, longShortRatio } })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
