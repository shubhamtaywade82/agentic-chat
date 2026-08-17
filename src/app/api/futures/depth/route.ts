import { NextRequest, NextResponse } from "next/server"
import { resolveBinanceClient } from "@/lib/live-tools"
import type { BinanceConfig } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  try {
    const { symbol, limit = 20, binance } = (await req.json()) as {
      symbol: string
      limit?: number
      binance?: BinanceConfig
    }

    if (!symbol) {
      return NextResponse.json({ success: false, error: "symbol is required" }, { status: 400 })
    }

    const client = resolveBinanceClient(binance)
    const cleanSymbol = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    const data = await client.futures.market.depth(cleanSymbol, limit)

    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
