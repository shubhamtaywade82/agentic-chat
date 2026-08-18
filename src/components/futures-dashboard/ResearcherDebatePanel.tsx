"use client"

import { useDashboardStore } from "@/store/dashboard-store"
import { Flame } from "lucide-react"

export function ResearcherDebatePanel({ symbol }: { symbol?: string }) {
  const activeSymbol = useDashboardStore((s) => s.activeSymbol)
  const sym = (symbol || activeSymbol).toUpperCase()

  const debates = [
    {
      round: 1,
      side: "bull" as const,
      text: `${sym} showing strong bullish structure. EMA 9/21 crossover on 15m with increasing volume. Bull flag pattern confirmed with measured move target expansion. Funding rates neutral — no overleveraged longs. On-chain data shows sustained exchange outflows, indicating supply squeeze.`,
    },
    {
      round: 1,
      side: "bear" as const,
      text: `RSI at 72 on 1H — approaching overbought territory. CCI peaked at 133 suggesting correction risk. Liquidations clustered near resistance. Whale wallet transactions detected on exchange — potential sell pressure. ATR increasing suggests incoming volatility.`,
    },
    {
      round: 2,
      side: "bull" as const,
      text: `Acknowledging RSI levels, but ADX at 28 confirms strong trend strength. MACD histogram expanding bullish. Exchange outflows support supply squeeze thesis. MVRV ratio well below overheated thresholds. Institutional derivatives flows remain net positive. Risk/reward at 3.7:1 justifies entry.`,
    },
    {
      round: 2,
      side: "bear" as const,
      text: `ADX declining from 35 to 28 — trend momentum slowing. ATR expansion warrants risk mitigation. Historical pattern: 78% of bull flags at this RSI level retrace 2-3% before continuation. Geopolitical and macro headlines could impact risk appetite.`,
    },
    {
      round: 3,
      side: "bull" as const,
      text: `Rebuttal: The ATR increase supports breakout volatility rather than reversal. Sentiment score at positive peak. Hash rate and active address momentum strong. Risk/reward at 3.7:1 justifies long position with calibrated invalidation stop.`,
    },
    {
      round: 3,
      side: "bear" as const,
      text: `Concession: Risk/reward is favorable IF structural support holds. However, position size should be reduced to 2.5% given volatility. Recommend tight invalidation stop and scaling entry in 2 tranches. Conservative approach prioritizes capital preservation while maintaining upside exposure.`,
    },
  ]

  return (
    <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Flame className="h-3.5 w-3.5 text-purple-400" />
          <span>Researcher Debate</span>{" "}
          <span className="font-mono text-[9px] font-normal text-muted-foreground">(Bull vs Bear · 3 rounds)</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="badge badge-bull">🐂 BULL Leading</span>
          <span className="font-mono text-[10px] text-muted-foreground">Round 3/3</span>
        </div>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {debates.map((d, idx) => {
          const isBull = d.side === "bull"
          return (
            <div
              key={`${d.side}-${d.round}-${idx}`}
              className={`debate-bubble ${isBull ? "debate-bull" : "debate-bear"}`}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span className={`badge ${isBull ? "badge-bull" : "badge-bear"}`}>
                  {isBull ? "🐂 BULL" : "🐻 BEAR"}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">Round {d.round}</span>
              </div>
              <p className="text-xs leading-relaxed text-foreground/90">{d.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
