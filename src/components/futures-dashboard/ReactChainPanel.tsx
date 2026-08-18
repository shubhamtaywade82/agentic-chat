"use client"

import { useDashboardStore } from "@/store/dashboard-store"

export function ReactChainPanel() {
  const activeSymbol = useDashboardStore((s) => s.activeSymbol)

  const steps = [
    {
      type: "thought" as const,
      agent: "Technical Analyst",
      text: `${activeSymbol} price testing key structural levels. Checking momentum indicators and volume profile to confirm breakout/reversal potential.`,
    },
    {
      type: "action" as const,
      agent: "Technical Analyst",
      text: `Call: get_binance_klines(${activeSymbol}, 15m, 100) → Call: calc_rsi(14) → Call: calc_macd(12,26,9) → Call: calc_bollinger(20,2) → Call: calc_atr(14)`,
    },
    {
      type: "observation" as const,
      agent: "Technical Analyst",
      text: `RSI(14) momentum active. EMA 9/21 cross confirmed. ATR volatility calibrated. Volume expanding above 20-period average.`,
    },
    {
      type: "thought" as const,
      agent: "Bull Researcher",
      text: `Technical structure confirms upside bias. Validating spot funding rates and exchange outflows to ensure no excessive liquidation squeeze risk.`,
    },
    {
      type: "action" as const,
      agent: "Sentiment / On-Chain Analyst",
      text: `Call: get_funding_rate(${activeSymbol}) → Call: get_long_short_ratio(${activeSymbol}) → Call: get_exchange_netflow(${activeSymbol})`,
    },
    {
      type: "observation" as const,
      agent: "Sentiment Analyst",
      text: `Binance funding rate neutral (+0.010%). Long/Short accounts balanced. Whale accumulation pattern intact.`,
    },
    {
      type: "thought" as const,
      agent: "Risk Manager (Neutral)",
      text: `Risk-to-reward ratio exceeds 1:2.8. Calibrating position sizing to 2.5% with strict stop-loss below demand invalidation.`,
    },
    {
      type: "action" as const,
      agent: "Fund Manager",
      text: `Multi-agent consensus achieved (≥4 factors aligned). Authorize trade execution with 3-tier TP limit ladders.`,
    },
  ]

  return (
    <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <span className="text-amber-400">🧠</span> ReAct Reasoning Chain{" "}
          <span className="font-mono text-[9px] font-normal text-muted-foreground">(Thought → Action → Observation)</span>
        </h3>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {steps.map((r, idx) => {
          const isThought = r.type === "thought"
          const isAction = r.type === "action"
          return (
            <div
              key={`${r.agent}-${idx}`}
              className={`react-step ${isThought ? "react-thought" : isAction ? "react-action" : "react-observation"}`}
            >
              <div className="mb-0.5 flex items-center gap-1.5">
                <span
                  className={`rounded px-1.5 py-0.2 font-mono text-[8px] font-bold uppercase ${
                    isThought
                      ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                      : isAction
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {r.type}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">{r.agent}</span>
              </div>
              <p
                className={`font-mono text-[10px] leading-relaxed ${
                  isThought ? "text-purple-300/90" : isAction ? "text-amber-300/90" : "text-emerald-300/90"
                }`}
              >
                {r.text}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
