import { NextRequest, NextResponse } from "next/server"
import * as DhanPkg from "@shubhamtaywade82/dhanhq-ts"
import * as BinancePkg from "binance-client-ts"
import type { BinanceConfig, DhanConfig } from "@/lib/agent-types"

const DhanClient = (DhanPkg as { DhanClient?: typeof DhanPkg.DhanClient; default?: { DhanClient?: typeof DhanPkg.DhanClient } }).DhanClient || (DhanPkg as { default?: { DhanClient?: typeof DhanPkg.DhanClient } }).default?.DhanClient || DhanPkg.DhanClient
const BinanceClient = (BinancePkg as { BinanceClient?: typeof BinancePkg.BinanceClient; default?: { BinanceClient?: typeof BinancePkg.BinanceClient } }).BinanceClient || (BinancePkg as { default?: { BinanceClient?: typeof BinancePkg.BinanceClient } }).default?.BinanceClient || BinancePkg.BinanceClient

export async function POST(req: NextRequest) {
  try {
    const { type, dhan, binance } = (await req.json()) as {
      type: "dhan" | "binance"
      dhan?: DhanConfig
      binance?: BinanceConfig
    }

    if (type === "binance") {
      const client = new BinanceClient({
        apiKey: binance?.apiKey || undefined,
        apiSecret: binance?.apiSecret || undefined,
        testnet: Boolean(binance?.testnet),
      })
      const serverTime = await client.futures.market.serverTime()
      return NextResponse.json({
        success: true,
        message: `Binance USD-M online! Server time: ${new Date(serverTime.serverTime).toISOString()}`,
      })
    }

    if (type === "dhan") {
      let client: InstanceType<typeof DhanClient>
      if (dhan?.authMode === "endpoint") {
        const endpointBaseUrl = dhan.endpointBaseUrl || "https://algo-trading-api.onrender.com"
        const bearerToken = dhan.bearerToken || process.env.DHAN_TOKEN_ACCESS_TOKEN || ""
        if (!bearerToken) {
          return NextResponse.json({ success: false, error: "Bearer token is required for endpoint authentication." }, { status: 400 })
        }
        client = await DhanClient.fromTokenEndpoint({ endpointBaseUrl, bearerToken })
      } else {
        const token = dhan?.token || process.env.DHAN_TOKEN || ""
        const clientId = dhan?.clientId || process.env.DHAN_CLIENT_ID || ""
        if (!token || !clientId) {
          return NextResponse.json({ success: false, error: "Both DHAN_TOKEN and DHAN_CLIENT_ID are required for direct mode." }, { status: 400 })
        }
        client = new DhanClient({ token, clientId })
      }

      const funds = await client.funds.getLimit()
      return NextResponse.json({
        success: true,
        message: `DhanHQ connected! Available balance: ₹${funds.availabelBalance ?? funds.sodLimit ?? "Active"}`,
        data: funds,
      })
    }

    return NextResponse.json({ success: false, error: "Invalid trading provider type" }, { status: 400 })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
