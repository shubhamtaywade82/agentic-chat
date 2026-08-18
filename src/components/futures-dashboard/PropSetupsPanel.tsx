"use client"

import { useEffect, useState } from "react"
import { Crosshair, RefreshCw, ShieldAlert, Sparkles } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { PropTradeSetup } from "@/lib/prop-engine"

interface PropSetupsPanelProps {
  onSelectSymbol: (symbol: string) => void
  currentSymbol: string
}

export function PropSetupsPanel({ onSelectSymbol, currentSymbol }: PropSetupsPanelProps) {
  const [setups, setSetups] = useState<PropTradeSetup[]>([])
  const [mode, setMode] = useState<"intraday" | "swing">("intraday")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSetups = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/futures/setups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to scan setups")
      setSetups(json.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSetups()
  }, [mode])

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prop Desk Radar ({mode})
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              onClick={() => setMode("intraday")}
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition ${
                mode === "intraday" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground"
              }`}
            >
              Intraday
            </button>
            <button
              onClick={() => setMode("swing")}
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition ${
                mode === "swing" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground"
              }`}
            >
              Swing
            </button>
          </div>
          <button
            onClick={loadSetups}
            disabled={loading}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {error && <p className="mb-2 text-[10px] text-red-500">{error}</p>}
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-2">
          {setups.map((s) => (
            <SetupCard
              key={`${s.symbol}-${s.mode}`}
              setup={s}
              isActive={currentSymbol.toUpperCase() === s.symbol}
              onSelect={() => onSelectSymbol(s.symbol)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SetupCard({ setup, isActive, onSelect }: { setup: PropTradeSetup; isActive: boolean; onSelect: () => void }) {
  const isTrade = setup.direction !== "NO_TRADE"
  const isLong = setup.direction === "LONG"

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-2.5 transition ${
        isActive
          ? "border-emerald-500/50 bg-emerald-500/10 shadow-sm"
          : "border-border/60 bg-card hover:border-border hover:bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold">{setup.symbol}</span>
          <span
            className={`rounded px-1 py-0.2 text-[9px] font-bold uppercase ${
              !isTrade
                ? "bg-muted text-muted-foreground"
                : isLong
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {setup.direction}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          ${setup.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </div>

      {isTrade ? (
        <div className="mt-2 space-y-1 text-[10px] font-mono">
          <div className="flex justify-between text-muted-foreground">
            <span>Entry Zone:</span>
            <span className="text-foreground">${setup.entry.zoneLow} - ${setup.entry.zoneHigh}</span>
          </div>
          <div className="flex justify-between text-red-400">
            <span>Stop Loss:</span>
            <span>${setup.stopLoss.price} (-{setup.stopLoss.distancePct}%)</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>Target (TP2):</span>
            <span>${setup.takeProfits[1]?.price || setup.takeProfits[0]?.price} (R:R 1:{setup.riskRewardRatio})</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-1 text-[9px]">
            <span className="text-emerald-400/90 font-medium">Confluence: {setup.confluenceScore}/6</span>
            <span className="text-muted-foreground">{setup.regime.label}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-muted-foreground">
          <ShieldAlert className="h-3 w-3" />
          <span>Waiting for structural confluence ({setup.confluenceScore}/6 aligned)</span>
        </div>
      )}
    </div>
  )
}
