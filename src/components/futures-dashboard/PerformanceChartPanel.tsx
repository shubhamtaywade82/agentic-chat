"use client"

import { TrendingUp } from "lucide-react"

export function PerformanceChartPanel() {
  const points = [
    { day: "D1", ta: 0, bh: 0, macd: 0 },
    { day: "D3", ta: 4.2, bh: 1.8, macd: 1.2 },
    { day: "D6", ta: 8.5, bh: 3.1, macd: 2.5 },
    { day: "D9", ta: 14.1, bh: 5.4, macd: 4.0 },
    { day: "D12", ta: 18.2, bh: 6.9, macd: 4.8 },
    { day: "D15", ta: 22.4, bh: 9.2, macd: 6.1 },
    { day: "D18", ta: 26.62, bh: 11.4, macd: 7.2 },
  ]

  // SVG coordinate mapping
  const width = 300
  const height = 110
  const maxVal = 30

  const getPoints = (key: "ta" | "bh" | "macd") => {
    return points
      .map((p, idx) => {
        const x = (idx / (points.length - 1)) * (width - 20) + 10
        const y = height - 15 - (p[key] / maxVal) * (height - 30)
        return `${x},${y}`
      })
      .join(" ")
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          <span>Cumulative Return vs Baselines</span>
        </h3>
        <span className="font-mono text-[9px] font-bold text-emerald-400">+26.62% Alpha</span>
      </div>

      {/* Legend */}
      <div className="mb-2 flex items-center justify-between font-mono text-[9px]">
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> TradingAgents
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Buy & Hold
        </span>
        <span className="flex items-center gap-1 text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> MACD Rule
        </span>
      </div>

      {/* SVG Chart */}
      <div className="relative h-[110px] w-full overflow-hidden rounded-lg bg-background/50 p-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
          {/* Grid lines */}
          <line x1="10" y1="20" x2={width - 10} y2="20" stroke="currentColor" strokeOpacity="0.08" />
          <line x1="10" y1="55" x2={width - 10} y2="55" stroke="currentColor" strokeOpacity="0.08" />
          <line x1="10" y1="95" x2={width - 10} y2="95" stroke="currentColor" strokeOpacity="0.12" />

          {/* Area under TradingAgents curve */}
          <polygon
            points={`10,95 ${getPoints("ta")} ${width - 10},95`}
            fill="rgba(34, 197, 94, 0.12)"
          />

          {/* Lines */}
          <polyline fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" points={getPoints("bh")} />
          <polyline fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" points={getPoints("macd")} />
          <polyline fill="none" stroke="#22c55e" strokeWidth="2" points={getPoints("ta")} />
        </svg>
      </div>
    </div>
  )
}
