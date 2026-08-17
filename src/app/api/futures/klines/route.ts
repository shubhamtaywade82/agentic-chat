import { NextRequest, NextResponse } from "next/server"
import { resolveBinanceClient } from "@/lib/live-tools"
import type { BinanceConfig } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  try {
    const { symbol, interval = "1h", limit = 100, binance } = (await req.json()) as {
      symbol: string
      interval?: string
      limit?: number
      binance?: BinanceConfig
    }

    if (!symbol) {
      return NextResponse.json({ success: false, error: "symbol is required" }, { status: 400 })
    }

    const client = resolveBinanceClient(binance)
    const cleanSymbol = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    const data = await client.futures.market.klines(
      cleanSymbol,
      interval as "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M",
      { limit }
    )

    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
