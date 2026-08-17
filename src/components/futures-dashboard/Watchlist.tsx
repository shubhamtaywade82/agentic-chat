"use client"

import { useLiveStream } from "@/lib/use-live-stream"
import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

export function Watchlist({ activeSymbol, onSelect }: { activeSymbol: string; onSelect: (symbol: string) => void }) {
  const { status, tickers, symbols } = useLiveStream()

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Watchlist</h3>
        <span className={cn("h-1.5 w-1.5 rounded-full", status === "connected" ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      </div>
      <div className="space-y-1">
        {symbols.map((symbol) => {
          const t = tickers[symbol]
          const isActive = symbol === activeSymbol
          return (
            <button
              key={symbol}
              onClick={() => onSelect(symbol)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition",
                isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <span className="font-mono">{symbol}</span>
              {t ? (
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  {t.direction === "up" ? (
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                  ) : t.direction === "down" ? (
                    <ArrowDown className="h-3 w-3 text-red-500" />
                  ) : (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span>${t.price.toLocaleString()}</span>
                  <span className={t.changePercent >= 0 ? "text-emerald-500" : "text-red-500"}>
                    {t.changePercent >= 0 ? "+" : ""}{t.changePercent.toFixed(2)}%
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground/50">loading…</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
