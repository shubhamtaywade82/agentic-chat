import { NextRequest, NextResponse } from "next/server"
import { resolveBinanceClient } from "@/lib/live-tools"
import type { BinanceConfig } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  try {
    const { binance } = (await req.json()) as { binance?: BinanceConfig }

    if (!binance?.apiKey || !binance?.apiSecret) {
      return NextResponse.json(
        { success: false, error: "Binance API key and secret are required to view positions" },
        { status: 400 }
      )
    }

    const client = resolveBinanceClient(binance)
    const allPositions = await client.futures.account.positionRisk()
    const openPositions = allPositions.filter((p) => p.positionAmt !== 0)

    return NextResponse.json({ success: true, data: openPositions })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
