"use client"

import { useDashboardStore, type AnalystTabKey } from "@/store/dashboard-store"
import { FileText } from "lucide-react"

export function AnalystReportsPanel({ symbol = "BTCUSDT" }: { symbol?: string }) {
  const activeSymbol = useDashboardStore((s) => s.activeSymbol)
  const normSym = (symbol || activeSymbol).toUpperCase()
  const activeTab = useDashboardStore((s) => s.analystTab)
  const setActiveTab = useDashboardStore((s) => s.setAnalystTab)

  const tabs: AnalystTabKey[] = ["Technical", "Sentiment", "News", "On-Chain"]

  return (
    <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <FileText className="h-3.5 w-3.5 text-cyan-400" />
          <span>Analyst Reports</span>{" "}
          <span className="font-mono text-[9px] font-normal text-muted-foreground">(Structured Docs)</span>
        </h3>
      </div>

      {/* Tabs */}
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`tab text-[10px] ${activeTab === t ? "tab-active font-semibold" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-60 space-y-1.5 overflow-y-auto text-xs leading-relaxed text-muted-foreground">
        {activeTab === "Technical" && (
          <div className="space-y-1">
            <p className="font-mono text-[11px] font-bold text-cyan-400">Technical Analysis Report — {normSym}</p>
            <p><strong className="text-foreground">Momentum:</strong> RSI(14)=68.4 rising, CCI=104.7 positive zone. Moderate buying momentum with overbought approaching.</p>
            <p><strong className="text-foreground">Trend:</strong> ADX=28 — trend directional. Supertrend bullish. EMA 9 &gt; EMA 21 confirmed on 15m chart.</p>
            <p><strong className="text-foreground">Volatility:</strong> ATR expanding — breakout momentum. Bollinger Bands expanding with upper band holding.</p>
            <p><strong className="text-foreground">Volume:</strong> VWMA trending above SMA(20). Volume 1.8x 20-period average on recent candles.</p>
            <p><strong className="text-foreground">MACD:</strong> Histogram +124 expanding. Signal line bullish crossover confirmed.</p>
            <p className="font-mono text-[11px] font-bold text-emerald-400 mt-1">→ Signal: BULLISH with caution on RSI resistance</p>
          </div>
        )}

        {activeTab === "Sentiment" && (
          <div className="space-y-1">
            <p className="font-mono text-[11px] font-bold text-purple-400">Sentiment Analysis Report — {normSym}</p>
            <p><strong className="text-foreground">Social Sentiment:</strong> Normalized score 0.54 (positive peak). Bullish mentions up 18% in 24h.</p>
            <p><strong className="text-foreground">Funding Rate:</strong> +0.010% (neutral-positive). No extreme overleveraged longs detected.</p>
            <p><strong className="text-foreground">Long/Short Ratio:</strong> 1.24 (long-biased). Top traders holding steady accumulation.</p>
            <p><strong className="text-foreground">Fear &amp; Greed:</strong> 72 (Greed). Up from 65 yesterday.</p>
            <p><strong className="text-foreground">ETF Flows:</strong> Net positive $340M this week. Institutional demand sustained.</p>
            <p className="font-mono text-[11px] font-bold text-emerald-400 mt-1">→ Signal: BULLISH sentiment, no overcrowding</p>
          </div>
        )}

        {activeTab === "News" && (
          <div className="space-y-1">
            <p className="font-mono text-[11px] font-bold text-amber-400">News &amp; Macro Report — Crypto Market</p>
            <p><strong className="text-foreground">Regulatory:</strong> SEC ETF review ongoing. No imminent negative rulings expected.</p>
            <p><strong className="text-foreground">Macro:</strong> Fed rate pause expected. CPI moderating. Dollar index (DXY) weakening.</p>
            <p><strong className="text-foreground">Geopolitical:</strong> Steady risk-on sentiment in equities correlating with crypto.</p>
            <p><strong className="text-foreground">Industry:</strong> Major institutional custody expansion. DeFi TVL up 12% MoM.</p>
            <p className="font-mono text-[11px] font-bold text-emerald-400 mt-1">→ Signal: NEUTRAL-POSITIVE macro backdrop</p>
          </div>
        )}

        {activeTab === "On-Chain" && (
          <div className="space-y-1">
            <p className="font-mono text-[11px] font-bold text-emerald-400">On-Chain / Fundamental Report — {normSym}</p>
            <p><strong className="text-foreground">Exchange Flows:</strong> Net outflow -12,400 units (7d). Supply squeeze developing.</p>
            <p><strong className="text-foreground">Whale Activity:</strong> Large withdrawals in 24h confirming accumulation pattern.</p>
            <p><strong className="text-foreground">MVRV Ratio:</strong> 1.82 — neutral-bullish zone (well below overheated 3.0).</p>
            <p><strong className="text-foreground">Hash Rate:</strong> Network security at ATH. Miner selling pressure minimal.</p>
            <p><strong className="text-foreground">Active Addresses:</strong> Elevated transaction counts above 90-day average.</p>
            <p className="font-mono text-[11px] font-bold text-emerald-400 mt-1">→ Signal: BULLISH on-chain fundamentals</p>
          </div>
        )}
      </div>
    </div>
  )
}
