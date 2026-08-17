"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetch("/api/futures/depth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, limit: 10 }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (!json.success) throw new Error(json.error || "Failed to load order book")
        setData(json.data)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    const timer = window.setInterval(() => {
      fetch("/api/futures/depth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, limit: 10 }),
      })
        .then((res) => res.json())
        .then((json) => !cancelled && json.success && setData(json.data))
        .catch(() => {})
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [symbol])

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{symbol} Order Book</h3>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      {!data && !error && <Skeleton className="h-40 w-full" />}
      {data && (
        <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
          <div>
            <div className="mb-1 text-muted-foreground">Bids</div>
            {data.bids.map(({ price, qty }) => (
              <div key={price} className="flex justify-between text-emerald-500">
                <span>{price.toLocaleString()}</span>
                <span>{qty.toFixed(3)}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 text-muted-foreground">Asks</div>
            {data.asks.map(({ price, qty }) => (
              <div key={price} className="flex justify-between text-red-500">
                <span>{price.toLocaleString()}</span>
                <span>{qty.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
