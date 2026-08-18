"use client"

import { useEffect, useState } from "react"
import { useAgentStore } from "@/store/agent-store"
import { useDashboardStore } from "@/store/dashboard-store"
import { Cpu, Radio, Users } from "lucide-react"

interface AgentItem {
  id: string
  name: string
  icon: string
  team: string
  role: string
  model: string
  targetTab?: "Technical" | "Sentiment" | "News" | "On-Chain"
}

const AGENTS: AgentItem[] = [
  { id: "tech", name: "Technical Analyst", icon: "📊", team: "Analyst", role: "RSI, MACD, Bollinger, ADX, ATR, CCI, Supertrend, VWMA (60 indicators)", model: "o1-preview", targetTab: "Technical" },
  { id: "sent", name: "Sentiment Analyst", icon: "🧠", team: "Analyst", role: "Social sentiment, funding rates, long/short ratio, fear & greed", model: "o1-preview", targetTab: "Sentiment" },
  { id: "news", name: "News Analyst", icon: "📰", team: "Analyst", role: "Macro events, regulatory news, ETF flows, geopolitical developments", model: "o1-preview", targetTab: "News" },
  { id: "fund", name: "On-Chain Analyst", icon: "⛓", team: "Analyst", role: "Whale movements, exchange flows, TVL, tokenomics, MVRV", model: "o1-preview", targetTab: "On-Chain" },
  { id: "bull", name: "Bull Researcher", icon: "🐂", team: "Research", role: "Advocates for opportunities, highlights positive signals & order blocks", model: "o1-preview" },
  { id: "bear", name: "Bear Researcher", icon: "🐻", team: "Research", role: "Identifies risks, questions viability, highlights downside liquidation", model: "o1-preview" },
  { id: "trader", name: "Trader Agent", icon: "⚡", team: "Trader", role: "Synthesizes debate insights, optimizes entry, stop-loss & TP ladders", model: "o1-preview" },
  { id: "risk", name: "Risk (Aggressive)", icon: "🔥", team: "Risk", role: "High-reward momentum strategies, larger sizing on confirmed breakouts", model: "o1-preview" },
  { id: "riskN", name: "Risk (Neutral)", icon: "⚖️", team: "Risk", role: "Balanced risk perspective, hedged scaling with 2.5% portfolio allocation", model: "o1-preview" },
  { id: "riskS", name: "Risk (Conservative)", icon: "🛡", team: "Risk", role: "Capital preservation, tighter invalidation stops and defensive sizing", model: "o1-preview" },
  { id: "fm", name: "Fund Manager", icon: "👔", team: "Approval", role: "Final consensus voting, adjusts risk profiles, authorizes live execution", model: "o1-preview" },
]

const PIPELINE = [
  { stage: "I", name: "Analyst Team", desc: "4 analysts gather data concurrently", agents: "Tech · Sentiment · News · On-Chain", status: "done" as const },
  { stage: "II", name: "Research Debate", desc: "Bull vs Bear n-round structured debate", agents: "Bull Researcher · Bear Researcher", status: "done" as const },
  { stage: "III", name: "Trader Decision", desc: "Synthesizes debate + reports → signal", agents: "Trader Agent", status: "active" as const },
  { stage: "IV", name: "Risk Management", desc: "3-profile risk assessment", agents: "Aggressive · Neutral · Conservative", status: "processing" as const },
  { stage: "V", name: "Fund Manager", desc: "Final approval & execution", agents: "Fund Manager", status: "waiting" as const },
]

const EVENT_TEMPLATES = [
  { tag: "EMA_CROSS", desc: "EMA(9) crossed EMA(21) on {s}", type: "bull" },
  { tag: "VOLUME_SPIKE", desc: "Volume 3.2x 20-period avg on {s}", type: "amber" },
  { tag: "RSI_DIVERGENCE", desc: "Bullish RSI divergence {s} 15m", type: "bull" },
  { tag: "FUNDING_RATE", desc: "Funding rate settlement +0.010% {s}", type: "neutral" },
  { tag: "LIQUIDATION", desc: "$2.4M short squeeze liquidations {s}", type: "bull" },
  { tag: "WHALE_ALERT", desc: "Whale wallet net outflow 500 {s}", type: "purple" },
  { tag: "BOLLINGER_SQUEEZE", desc: "Bollinger Band squeeze expansion on {s}", type: "bull" },
  { tag: "MACD_CROSS", desc: "MACD bullish crossover {s} 1h", type: "bull" },
  { tag: "OI_SPIKE", desc: "Open interest +12% on {s}", type: "amber" },
]

export function AgentRosterPanel() {
  const config = useAgentStore((s) => s.config)
  const activeSymbol = useDashboardStore((s) => s.activeSymbol)
  const setAnalystTab = useDashboardStore((s) => s.setAnalystTab)
  const setActiveSymbol = useDashboardStore((s) => s.setActiveSymbol)
  const activeModel = config?.modelId || "o1-preview"

  const [events, setEvents] = useState([
    { id: "1", tag: "EMA_CROSS", desc: `EMA(9) crossed EMA(21) on ${activeSymbol}`, time: "Just now", sym: activeSymbol, type: "bull" },
    { id: "2", tag: "VOLUME_SPIKE", desc: "Volume 3.2x 20-period avg on BTCUSDT", time: "1m ago", sym: "BTCUSDT", type: "amber" },
    { id: "3", tag: "RSI_DIVERGENCE", desc: "Bullish RSI divergence SOLUSDT 15m", time: "2m ago", sym: "SOLUSDT", type: "bull" },
    { id: "4", tag: "FUNDING_RATE", desc: "Funding rate settlement +0.010% ETHUSDT", time: "3m ago", sym: "ETHUSDT", type: "neutral" },
  ])

  useEffect(() => {
    const timer = setInterval(() => {
      const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]
      const sym = symbols[Math.floor(Math.random() * symbols.length)]
      const tmpl = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)]
      const newEv = {
        id: String(Date.now()),
        tag: tmpl.tag,
        desc: tmpl.desc.replace("{s}", sym),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        sym,
        type: tmpl.type,
      }
      setEvents((prev) => [newEv, ...prev.slice(0, 7)])
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const teams = ["Analyst", "Research", "Trader", "Risk", "Approval"]
  const teamColors: Record<string, string> = {
    Analyst: "text-cyan-400",
    Research: "text-purple-400",
    Trader: "text-amber-400",
    Risk: "text-rose-400",
    Approval: "text-emerald-400",
  }

  return (
    <div className="space-y-3">
      {/* 11-Agent Roster */}
      <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
        <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <span className="text-cyan-400">⚙</span> Agent Roster{" "}
            <span className="font-mono text-[9px] font-normal text-muted-foreground">(TradingAgents Paper)</span>
          </h3>
          <span className="flex items-center gap-1 rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-cyan-400">
            <span className="dot-green" style={{ width: "5px", height: "5px" }} /> 11 Active
          </span>
        </div>

        <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
          {teams.map((t) => {
            const teamAgents = AGENTS.filter((a) => a.team === t)
            return (
              <div key={t} className="space-y-1">
                <p className={`font-mono text-[9px] font-bold uppercase tracking-wider ${teamColors[t]}`}>
                  {t} Team
                </p>
                {teamAgents.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => a.targetTab && setAnalystTab(a.targetTab)}
                    className="agent-card flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-1.5 transition hover:border-cyan-500/40 hover:bg-muted/30"
                  >
                    <span className="text-sm">{a.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[10px] font-semibold text-foreground">{a.name}</span>
                        <div className="dot-green" style={{ width: "5px", height: "5px" }} />
                      </div>
                      <p className="line-clamp-1 text-[9px] text-muted-foreground">{a.role}</p>
                      <p className="font-mono text-[8px] text-muted-foreground/70">Model: {activeModel}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* 5-Stage Pipeline */}
      <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
        <h3 className="mb-2.5 flex items-center gap-1.5 border-b border-border/50 pb-2 text-xs font-bold text-foreground">
          <span className="text-purple-400">⚡</span> 5-Stage Agent Pipeline
        </h3>
        <div className="space-y-0">
          {PIPELINE.map((p, idx) => {
            const isDone = p.status === "done"
            const isActive = p.status === "active"
            const isProcessing = p.status === "processing"

            return (
              <div key={p.stage} className="flex items-start gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                      isDone
                        ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                        : isActive
                        ? "border border-cyan-500/40 bg-cyan-500/20 text-cyan-400"
                        : isProcessing
                        ? "border border-amber-500/40 bg-amber-500/20 text-amber-400"
                        : "border border-border/40 bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {isDone ? "✓" : isActive ? "▶" : isProcessing ? "◉" : "○"}
                  </div>
                  {idx < PIPELINE.length - 1 && (
                    <div className={`connector ${isDone ? "connector-active" : "connector-waiting"}`} />
                  )}
                </div>

                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-[10px] font-bold ${isDone ? "text-emerald-400" : isActive ? "text-cyan-400" : isProcessing ? "text-amber-400" : "text-muted-foreground"}`}>
                      {p.stage}.
                    </span>
                    <span className="text-[11px] font-semibold text-foreground">{p.name}</span>
                    {isProcessing && (
                      <div className="ml-1 flex gap-0.5">
                        <div className="h-1 w-1 rounded-full bg-amber-400 flow-dot" />
                        <div className="h-1 w-1 rounded-full bg-amber-400 flow-dot" />
                        <div className="h-1 w-1 rounded-full bg-amber-400 flow-dot" />
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground">{p.desc}</p>
                  <p className="font-mono text-[8px] text-muted-foreground/70">{p.agents}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Event-Driven Triggers */}
      <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
        <h3 className="mb-2 flex items-center justify-between border-b border-border/50 pb-2 text-xs font-bold text-foreground">
          <span className="flex items-center gap-1.5">
            <span className="text-amber-400">🔔</span> Event-Driven Triggers
          </span>
          <span className="font-mono text-[8px] text-muted-foreground">Live Feed</span>
        </h3>
        <div className="max-h-44 space-y-1 overflow-y-auto">
          {events.map((e) => (
            <div
              key={e.id}
              onClick={() => setActiveSymbol(e.sym)}
              className="slide-in flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/40 bg-background/50 p-1.5 transition hover:border-amber-500/40 hover:bg-muted/30"
            >
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-bold ${
                  e.type === "bull"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : e.type === "amber"
                    ? "bg-amber-500/15 text-amber-400"
                    : e.type === "purple"
                    ? "bg-purple-500/15 text-purple-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {e.tag}
              </span>
              <span className="min-w-0 flex-1 truncate text-[9px] text-foreground/90">{e.desc}</span>
              <span className="font-mono text-[8px] text-muted-foreground">{e.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
