"use client"

import { useDashboardStore, type RiskProfileKey } from "@/store/dashboard-store"
import { Shield, UserCheck } from "lucide-react"

export function RiskAndFundManagerPanel({ symbol = "BTCUSDT" }: { symbol?: string }) {
  const activeSymbol = useDashboardStore((s) => s.activeSymbol)
  const normSym = (symbol || activeSymbol).toUpperCase()
  const selectedProfile = useDashboardStore((s) => s.riskProfile)
  const setSelectedProfile = useDashboardStore((s) => s.setRiskProfile)

  return (
    <div className="space-y-3">
      {/* Risk Management Team */}
      <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
        <h3 className="mb-2 flex items-center gap-1.5 border-b border-border/50 pb-2 text-xs font-bold text-foreground">
          <Shield className="h-3.5 w-3.5 text-rose-400" />
          <span>Risk Management Team</span>{" "}
          <span className="font-mono text-[9px] font-normal text-muted-foreground">(3 Profiles)</span>
        </h3>

        <div className="space-y-2">
          {/* Aggressive */}
          <div
            onClick={() => setSelectedProfile("aggressive")}
            className={`cursor-pointer rounded-lg border p-2 transition ${
              selectedProfile === "aggressive"
                ? "border-rose-500/40 bg-rose-500/10 shadow-xs"
                : "border-rose-500/15 bg-rose-500/[.03] hover:border-rose-500/30"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="badge badge-risk">🔥 Aggressive</span>
              <span className="font-mono text-[10px] font-bold text-emerald-400">Approve 3.0%</span>
            </div>
            <p className="text-[9px] leading-relaxed text-muted-foreground">
              Momentum is strong. ATR breakout supports larger position. R:R 3.7:1 justifies 3% sizing. Trail stop after TP1.
            </p>
          </div>

          {/* Neutral */}
          <div
            onClick={() => setSelectedProfile("neutral")}
            className={`cursor-pointer rounded-lg border p-2 transition ${
              selectedProfile === "neutral"
                ? "border-amber-500/40 bg-amber-500/10 shadow-xs"
                : "border-slate-500/15 bg-slate-500/[.03] hover:border-slate-500/30"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="badge badge-neutral">⚖️ Neutral</span>
              <span className="font-mono text-[10px] font-bold text-amber-400">Approve 2.5%</span>
            </div>
            <p className="text-[9px] leading-relaxed text-muted-foreground">
              Balanced view. Approve 2.5% allocation with strict demand stop. Scale entry across 2 tranches to manage volatility.
            </p>
          </div>

          {/* Conservative */}
          <div
            onClick={() => setSelectedProfile("conservative")}
            className={`cursor-pointer rounded-lg border p-2 transition ${
              selectedProfile === "conservative"
                ? "border-blue-500/40 bg-blue-500/10 shadow-xs"
                : "border-blue-500/15 bg-blue-500/[.03] hover:border-blue-500/30"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="badge badge-safe">🛡 Conservative</span>
              <span className="font-mono text-[10px] font-bold text-blue-400">Approve 1.5%</span>
            </div>
            <p className="text-[9px] leading-relaxed text-muted-foreground">
              RSI approaching overbought. ATR rising = volatility risk. Reduce to 1.5%, tighter invalidation stop.
            </p>
          </div>
        </div>
      </div>

      {/* Fund Manager Decision */}
      <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 shadow-xs">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
            <UserCheck className="h-3.5 w-3.5 text-purple-400" />
            <span>Fund Manager Decision</span>
          </h3>
          <span className="badge badge-approved">✅ APPROVED</span>
        </div>

        <div className="space-y-1 text-xs">
          <p className="font-mono text-[11px] text-foreground">
            <strong className="text-purple-400">Decision: BUY {normSym}</strong> with{" "}
            <strong className="text-amber-400 capitalize">{selectedProfile}</strong> profile (
            {selectedProfile === "aggressive" ? "3.0%" : selectedProfile === "neutral" ? "2.5%" : "1.5%"} sizing)
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Multi-tier TP ladder authorized. Rationale: Strong on-chain fundamentals and institutional derivatives inflows outweigh overbought RSI concerns.
          </p>
        </div>
      </div>
    </div>
  )
}
