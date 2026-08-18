"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Bot } from "lucide-react"
import { useAgentStore } from "@/store/agent-store"
import { useDashboardStore } from "@/store/dashboard-store"
import { useLiveStream } from "@/lib/use-live-stream"
import { TopKpiBar } from "./TopKpiBar"
import { AgentRosterPanel } from "./AgentRosterPanel"
import { PriceChart } from "./PriceChart"
import { ResearcherDebatePanel } from "./ResearcherDebatePanel"
import { HighProbabilitySetupsPanel } from "./HighProbabilitySetupsPanel"
import { ReactChainPanel } from "./ReactChainPanel"
import { AnalystReportsPanel } from "./AnalystReportsPanel"
import { RiskAndFundManagerPanel } from "./RiskAndFundManagerPanel"
import { ToolCallsPanel } from "./ToolCallsPanel"
import { PerformanceChartPanel } from "./PerformanceChartPanel"
import { OrderBookPanel } from "./OrderBookPanel"
import { ThemeToggle } from "@/components/theme-toggle"
import { Brain } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MemoriesTab } from "@/components/agent-chat/memories-tab"

export function FuturesDashboard() {
  const activeSymbol = useDashboardStore((s) => s.activeSymbol)
  const config = useAgentStore((s) => s.config)
  const hydrateFromStorage = useAgentStore((s) => s.hydrateFromStorage)
  const { tickers, status } = useLiveStream([activeSymbol])
  const ticker = tickers[activeSymbol.toUpperCase()]
  const activeModel = config?.modelId || "llama3.1:70b"

  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Header matching TradingAgents mock */}
      <header className="glass mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 p-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-border/80 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Agent Chat
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 font-bold text-white shadow-sm">
            TA
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-base font-bold text-transparent leading-tight sm:text-lg">
              TradingAgents Crypto
            </h1>
            <p className="text-[10px] text-muted-foreground">Multi-Agent LLM Framework · Inspired by Tauric Research</p>
          </div>
          <div className="hidden items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 md:flex">
            <div className="dot-green" />
            <span className="font-mono text-[10px] font-semibold text-emerald-400">RUNTIME ACTIVE</span>
          </div>
        </div>

        {/* Live Status Chips + Memory + Theme Toggle */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground sm:gap-3">
          <span>Model: <span className="text-cyan-400">{activeModel}</span></span>
          <span className="text-border">│</span>
          <span>Binance WS: <span className="text-emerald-400">{status === "connected" ? "Connected" : status}</span></span>
          <span className="text-border">│</span>
          <span>Agents: <span className="text-purple-400">11 Active</span></span>
          <span className="text-border">│</span>
          <span>ReAct: <span className="text-amber-400">Enabled</span></span>
          <span className="text-border">│</span>
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="flex cursor-pointer items-center gap-1 rounded border border-border/80 bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-emerald-500/40 hover:text-foreground"
                title="View and configure persistent agent memories and learned patterns"
              >
                <Brain className="h-3 w-3 text-emerald-400" />
                <span>Memory: <strong className="text-emerald-400">{config.memories?.filter((m) => m.enabled).length || 3} Active</strong></span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="sr-only">Agent Long-Term Memory & Learning</DialogTitle>
              </DialogHeader>
              <MemoriesTab />
            </DialogContent>
          </Dialog>
          <span className="text-border">│</span>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 space-y-3 p-3">
        {/* Top 8-Metric Stats Bar */}
        <TopKpiBar symbol={activeSymbol} />

        {/* 3-Column Multi-Agent Layout */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Left Column: 11-Agent Roster, 5-Stage Pipeline, Event Triggers */}
          <div className="space-y-3 lg:col-span-3">
            <AgentRosterPanel />
          </div>

          {/* Center Column: Price Chart, Debate, Trade Setups, ReAct Chain */}
          <div className="min-w-0 space-y-3 lg:col-span-6">
            <PriceChart />
            <ResearcherDebatePanel symbol={activeSymbol} />
            <HighProbabilitySetupsPanel />
            <ReactChainPanel />
          </div>

          {/* Right Column: Analyst Reports, Risk Team & Fund Mgr, Tool Calls, Performance, Orderbook */}
          <div className="space-y-3 lg:col-span-3">
            <AnalystReportsPanel symbol={activeSymbol} />
            <RiskAndFundManagerPanel symbol={activeSymbol} />
            <ToolCallsPanel symbol={activeSymbol} />
            <PerformanceChartPanel />
            <OrderBookPanel key={`orderbook-${activeSymbol}`} symbol={activeSymbol} />
          </div>
        </div>
      </main>
    </div>
  )
}
