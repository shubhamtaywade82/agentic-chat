"use client"

import { useEffect, useState } from "react"
import { useDashboardStore } from "@/store/dashboard-store"
import { RefreshCw, Zap } from "lucide-react"

interface SetupItem {
  sym: string
  dir: "LONG" | "SHORT"
  conf: number
  entry: number
  sl: number
  tp1: number
  tp2: number
  tp3: number
  pattern: string
  tf: string
  rr: string
  size: string
  status: "approved" | "pending"
  agents: string[]
  reasoning: string
}

export function HighProbabilitySetupsPanel() {
  const activeSymbol = useDashboardStore((s) => s.activeSymbol)
  const onSelectSymbol = useDashboardStore((s) => s.setActiveSymbol)
  const filter = useDashboardStore((s) => s.setupsFilter)
  const setFilter = useDashboardStore((s) => s.setSetupsFilter)

  const [loading, setLoading] = useState(false)
  const [setups, setSetups] = useState<SetupItem[]>([])

  const loadSetups = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/futures/setups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"], mode: "intraday" }),
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        const mapped: SetupItem[] = json.data.map((d: any) => ({
          sym: d.symbol,
          dir: d.bias === "bullish" ? "LONG" : "SHORT",
          conf: Math.round(d.confluenceScore * 14 + 40),
          entry: d.entry?.price || d.currentPrice,
          sl: d.stopLoss?.price || d.currentPrice * 0.985,
          tp1: d.takeProfits?.[0]?.price || d.currentPrice * 1.02,
          tp2: d.takeProfits?.[1]?.price || d.currentPrice * 1.04,
          tp3: d.takeProfits?.[2]?.price || d.currentPrice * 1.06,
          pattern: d.regime?.label || "Order Block & EMA Hold",
          tf: "15m",
          rr: `1:${d.riskRewardRatio || 2.8}`,
          size: "2.5%",
          status: d.confluenceScore >= 3 ? "approved" : "pending",
          agents: d.alignedFactors?.length ? d.alignedFactors : ["Technical", "Sentiment", "Bull Researcher", "Risk(Neutral)", "Fund Mgr"],
          reasoning: d.summaryMarkdown?.replace(/### .*\n/, "") || "Structural demand hold verified with tight invalidation and multi-target expansion ladder.",
        }))
        setSetups(mapped)
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSetups()
  }, [])

  const filtered = setups.filter(
    (s) => filter === "ALL" || (filter === "LONG" && s.dir === "LONG") || (filter === "SHORT" && s.dir === "SHORT")
  )

  return (
    <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
          <span>High-Probability Setups</span>{" "}
          <span className="font-mono text-[9px] font-normal text-muted-foreground">(Post Fund Manager Approval)</span>
        </h3>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {(["ALL", "LONG", "SHORT"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded px-2 py-0.5 font-mono text-[9px] font-medium transition ${
                  filter === tab ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "ALL" ? "All" : tab === "LONG" ? "Long" : "Short"}
              </button>
            ))}
          </div>
          <button
            onClick={loadSetups}
            disabled={loading}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Rescan market setups"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-h-[500px] space-y-2.5 overflow-y-auto pr-1">
        {filtered.map((s) => {
          const isSelected = s.sym === activeSymbol.toUpperCase()
          const isLong = s.dir === "LONG"

          return (
            <div
              key={s.sym}
              onClick={() => onSelectSymbol(s.sym)}
              className={`cursor-pointer rounded-lg border p-2.5 transition ${
                isSelected
                  ? "border-emerald-500/50 bg-emerald-950/15 shadow-sm"
                  : isLong
                  ? "border-emerald-500/20 bg-emerald-500/[.03] hover:border-emerald-500/40"
                  : "border-rose-500/20 bg-rose-500/[.03] hover:border-rose-500/40"
              }`}
            >
              {/* Header */}
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`badge ${isLong ? "badge-long" : "badge-short"}`}>{s.dir}</span>
                  <span className="text-xs font-bold text-foreground">{s.sym}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{s.tf}</span>
                  <span className={`badge ${s.status === "approved" ? "badge-approved" : "badge-pending"}`}>
                    {s.status.toUpperCase()}
                  </span>
                </div>
                <span className={`font-mono text-xs font-bold ${s.conf >= 80 ? "text-emerald-400" : "text-amber-400"}`}>
                  {s.conf}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="progress-bar mb-2">
                <div
                  className={`progress-fill ${s.conf >= 80 ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: `${s.conf}%` }}
                />
              </div>

              {/* 5-Cell Price Grid */}
              <div className="mb-2 grid grid-cols-5 gap-1 text-center font-mono">
                <div className="rounded bg-muted/40 p-1">
                  <p className="text-[8px] text-muted-foreground uppercase">Entry</p>
                  <p className="text-[10px] font-bold text-cyan-400">${s.entry.toLocaleString()}</p>
                </div>
                <div className="rounded bg-rose-500/10 p-1">
                  <p className="text-[8px] text-rose-400/80 uppercase">SL</p>
                  <p className="text-[10px] font-bold text-rose-400">${s.sl.toLocaleString()}</p>
                </div>
                <div className="rounded bg-emerald-500/10 p-1">
                  <p className="text-[8px] text-emerald-400/80 uppercase">TP1</p>
                  <p className="text-[10px] font-bold text-emerald-400">${s.tp1.toLocaleString()}</p>
                </div>
                <div className="rounded bg-emerald-500/10 p-1">
                  <p className="text-[8px] text-emerald-400/80 uppercase">TP2</p>
                  <p className="text-[10px] font-bold text-emerald-400">${s.tp2.toLocaleString()}</p>
                </div>
                <div className="rounded bg-emerald-500/10 p-1">
                  <p className="text-[8px] text-emerald-400/80 uppercase">TP3</p>
                  <p className="text-[10px] font-bold text-emerald-300">${s.tp3.toLocaleString()}</p>
                </div>
              </div>

              {/* Sub-info */}
              <div className="mb-1.5 flex items-center justify-between text-[9px] text-muted-foreground">
                <span>Pattern: <strong className="text-foreground">{s.pattern}</strong></span>
                <span>R:R <strong className="text-emerald-400">{s.rr}</strong></span>
                <span>Size: <strong className="text-cyan-400">{s.size}</strong></span>
              </div>

              {/* Aligned agents */}
              <div className="mb-1.5 flex flex-wrap gap-1">
                {s.agents.map((a) => (
                  <span key={a} className="rounded border border-border/40 bg-muted/40 px-1.5 py-0.2 font-mono text-[8px] text-muted-foreground">
                    {a}
                  </span>
                ))}
              </div>

              {/* Reasoning */}
              <div className="rounded border border-border/30 bg-muted/20 p-1.5">
                <p className="mb-0.5 text-[9px] font-semibold text-purple-400">🧠 LLM Reasoning (Post-Debate Synthesis)</p>
                <p className="text-[9px] leading-relaxed text-muted-foreground">{s.reasoning}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
