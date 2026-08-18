"use client"

import { useEffect, useState } from "react"
import { useDashboardStore } from "@/store/dashboard-store"

export function TopKpiBar({ symbol = "BTCUSDT" }: { symbol?: string }) {
  const [eventsPerMin, setEventsPerMin] = useState(24)

  useEffect(() => {
    const timer = setInterval(() => {
      setEventsPerMin(Math.floor(Math.random() * 14 + 18))
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  const stats = [
    { label: "Active Agents", value: "11/11", color: "text-cyan-400" },
    { label: "Debate Rounds", value: "3", color: "text-purple-400" },
    { label: "Open Setups", value: "4", color: "text-emerald-400" },
    { label: "Win Rate", value: "74.8%", color: "text-emerald-400" },
    { label: "Sharpe Ratio", value: "8.21", color: "text-amber-400" },
    { label: "Max Drawdown", value: "0.91%", color: "text-red-400" },
    { label: "Cumulative Return", value: "+26.62%", color: "text-emerald-400" },
    { label: "Events/min", value: String(eventsPerMin), color: "text-blue-400" },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-border/80 bg-card/70 p-2.5 shadow-xs transition hover:border-cyan-500/30"
        >
          <p className="text-[10px] font-medium text-muted-foreground">{s.label}</p>
          <p className={`mt-0.5 font-mono text-lg font-bold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  )
}
