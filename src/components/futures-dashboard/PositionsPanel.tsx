"use client"

import { useEffect, useState } from "react"
import { useAgentStore } from "@/store/agent-store"
import { Skeleton } from "@/components/ui/skeleton"

interface Position {
  symbol: string
  positionAmt: number
  entryPrice: number
  markPrice: number
  unRealizedProfit: number
  leverage: number
  positionSide: string
}

export function PositionsPanel() {
  const binanceConfig = useAgentStore((s) => s.config.binance)
  const [positions, setPositions] = useState<Position[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!binanceConfig?.apiKey || !binanceConfig?.apiSecret) {
      return
    }
    let cancelled = false
    const load = () => {
      fetch("/api/futures/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binance: binanceConfig }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return
          if (!json.success) throw new Error(json.error || "Failed to load positions")
          setError(null)
          setPositions(json.data)
        })
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    }
    load()
    const timer = window.setInterval(load, 10000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [binanceConfig])

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Open Positions</h3>
      {!binanceConfig?.apiKey || !binanceConfig?.apiSecret ? (
        <p className="text-[10px] text-muted-foreground">
          Add a Binance API key in Agent Config to see live positions.
        </p>
      ) : error ? (
        <p className="text-[10px] text-red-500">{error}</p>
      ) : positions === null ? (
        <Skeleton className="h-16 w-full" />
      ) : positions.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">No open positions.</p>
      ) : (
        <div className="space-y-2">
          {positions.map((p) => (
            <div key={`${p.symbol}-${p.positionSide}`} className="rounded-lg border border-border/60 bg-background/50 p-2 text-xs">
              <div className="flex items-center justify-between font-mono">
                <span className="font-semibold">{p.symbol}</span>
                <span className={p.unRealizedProfit >= 0 ? "text-emerald-500" : "text-red-500"}>
                  {p.unRealizedProfit >= 0 ? "+" : ""}{p.unRealizedProfit.toFixed(2)} USDT
                </span>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{p.positionAmt > 0 ? "LONG" : "SHORT"} {Math.abs(p.positionAmt)} @ {p.entryPrice}</span>
                <span>{p.leverage}x</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
