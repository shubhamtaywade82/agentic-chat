import { NextRequest, NextResponse } from "next/server"
import { evaluatePropSetup, scanPropWatchlist, DEFAULT_PROP_WATCHLIST } from "@/lib/prop-engine"
import type { BinanceConfig } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  try {
    const { symbol, symbols, mode = "intraday", binance } = (await req.json()) as {
      symbol?: string
      symbols?: string[]
      mode?: "intraday" | "swing"
      binance?: BinanceConfig
    }

    if (symbol) {
      const data = await evaluatePropSetup(symbol, mode, binance)
      return NextResponse.json({ success: true, data })
    }

    const targetSymbols = Array.isArray(symbols) && symbols.length > 0 ? symbols : DEFAULT_PROP_WATCHLIST
    const data = await scanPropWatchlist(targetSymbols, mode, binance)
    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
