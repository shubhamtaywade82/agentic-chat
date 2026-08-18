"use client"

import { useEffect, useState, useRef } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface DepthLevel {
  price: number
  qty: number
}

interface DepthData {
  bids: DepthLevel[]
  asks: DepthLevel[]
}

export function OrderBookPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<DepthData | null>(null)
  const [status, setStatus] = useState<"connected" | "connecting" | "disconnected">("connecting")
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let isSubscribed = true

    // Binance USD-M 10-level depth stream updated every 100ms
    const stream = `${symbol.toLowerCase()}@depth10@100ms`
    const ws = new WebSocket(`wss://fstream.binance.com/ws/${stream}`)
    wsRef.current = ws

    ws.onopen = () => {
      if (isSubscribed) setStatus("connected")
    }

    ws.onmessage = (event) => {
      if (!isSubscribed) return
      try {
        const payload = JSON.parse(event.data)
        if (!payload.b || !payload.a) return
        const bids = payload.b.map(([p, q]: [string, string]) => ({ price: parseFloat(p), qty: parseFloat(q) }))
        const asks = payload.a.map(([p, q]: [string, string]) => ({ price: parseFloat(p), qty: parseFloat(q) }))
        setData({ bids, asks })
      } catch {
        // Ignore parse errors from non-depth frames
      }
    }

    ws.onerror = () => {
      if (isSubscribed) setStatus("disconnected")
    }

    ws.onclose = () => {
      if (isSubscribed) setStatus("disconnected")
    }

    return () => {
      isSubscribed = false
      ws.close()
      wsRef.current = null
    }
  }, [symbol])

  const maxBidQty = data?.bids.reduce((max, b) => Math.max(max, b.qty), 0) || 1
  const maxAskQty = data?.asks.reduce((max, a) => Math.max(max, a.qty), 0) || 1
  const bestBid = data?.bids[0]?.price
  const bestAsk = data?.asks[0]?.price
  const spread = bestBid && bestAsk ? bestAsk - bestBid : null

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {symbol} Live Order Book
          </h3>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              status === "connected" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
            )}
            title={`WebSocket: ${status}`}
          />
        </div>
        {spread !== null && (
          <span className="font-mono text-[10px] text-muted-foreground">
            Spread: <span className="text-foreground">{spread.toFixed(2)}</span>
          </span>
        )}
      </div>

      {!data && <Skeleton className="h-40 w-full" />}
      {data && (
        <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
          <div>
            <div className="mb-1 flex justify-between text-muted-foreground">
              <span>Bid Price</span>
              <span>Size</span>
            </div>
            {data.bids.map(({ price, qty }) => {
              const depthPct = Math.min(100, Math.round((qty / maxBidQty) * 100))
              return (
                <div key={price} className="relative flex justify-between py-0.5 text-emerald-500">
                  <div
                    className="absolute inset-y-0 right-0 bg-emerald-500/10 rounded-sm pointer-events-none"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative z-10">{price.toLocaleString()}</span>
                  <span className="relative z-10 text-emerald-400/80">{qty.toFixed(3)}</span>
                </div>
              )
            })}
          </div>
          <div>
            <div className="mb-1 flex justify-between text-muted-foreground">
              <span>Ask Price</span>
              <span>Size</span>
            </div>
            {data.asks.map(({ price, qty }) => {
              const depthPct = Math.min(100, Math.round((qty / maxAskQty) * 100))
              return (
                <div key={price} className="relative flex justify-between py-0.5 text-red-500">
                  <div
                    className="absolute inset-y-0 left-0 bg-red-500/10 rounded-sm pointer-events-none"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative z-10">{price.toLocaleString()}</span>
                  <span className="relative z-10 text-red-400/80">{qty.toFixed(3)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
