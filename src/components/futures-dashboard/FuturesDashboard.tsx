"use client"

import { useState } from "react"
import Link from "next/link"
import { LineChart, ArrowLeft } from "lucide-react"

export function FuturesDashboard() {
  const [activeSymbol, setActiveSymbol] = useState("BTCUSDT")

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Agent
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <LineChart className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold">Futures Dashboard</h1>
            <p className="hidden text-[10px] text-muted-foreground sm:block">
              Binance USD-M · {activeSymbol} · intraday & swing
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_300px]">
          <div id="dashboard-watchlist-slot" />
          <div className="space-y-4">
            <div id="dashboard-chart-slot" />
            <div id="dashboard-orderbook-slot" />
          </div>
          <div className="space-y-4">
            <div id="dashboard-sentiment-slot" />
            <div id="dashboard-positions-slot" />
          </div>
        </div>
      </div>
    </div>
  )
}
