"use client"

import { useEffect, useState } from "react"
import { useDashboardStore } from "@/store/dashboard-store"
import { Wrench } from "lucide-react"

interface ToolCall {
  name: string
  args: string
  agent: string
  status: "done" | "processing"
}

export function ToolCallsPanel({ symbol = "BTCUSDT" }: { symbol?: string }) {
  const activeSymbol = useDashboardStore((s) => s.activeSymbol)
  const normSym = (symbol || activeSymbol).toUpperCase()
  const [toolCallCount, setToolCallCount] = useState(24)

  useEffect(() => {
    const timer = setInterval(() => {
      setToolCallCount((prev) => prev + Math.floor(Math.random() * 2 + 1))
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const tools: ToolCall[] = [
    { name: "get_binance_klines", args: `${normSym}, 15m, 100`, agent: "Technical", status: "done" },
    { name: "calc_rsi", args: "period=14", agent: "Technical", status: "done" },
    { name: "calc_macd", args: "12, 26, 9", agent: "Technical", status: "done" },
    { name: "calc_bollinger", args: "20, 2", agent: "Technical", status: "done" },
    { name: "calc_adx", args: "period=14", agent: "Technical", status: "done" },
    { name: "calc_atr", args: "period=14", agent: "Technical", status: "done" },
    { name: "calc_cci", args: "period=20", agent: "Technical", status: "done" },
    { name: "calc_supertrend", args: "period=10", agent: "Technical", status: "done" },
    { name: "calc_vwma", args: "period=20", agent: "Technical", status: "done" },
    { name: "get_funding_rate", args: normSym, agent: "Sentiment", status: "done" },
    { name: "get_long_short_ratio", args: normSym, agent: "Sentiment", status: "done" },
    { name: "get_social_sentiment", args: `${normSym}, 24h`, agent: "Sentiment", status: "done" },
    { name: "get_fear_greed_index", args: "crypto", agent: "Sentiment", status: "done" },
    { name: "get_exchange_netflow", args: `${normSym}, 7d`, agent: "On-Chain", status: "done" },
    { name: "get_whale_transactions", args: ">100BTC, 24h", agent: "On-Chain", status: "done" },
    { name: "get_mvrv_ratio", args: normSym, agent: "On-Chain", status: "done" },
    { name: "get_hash_rate", args: normSym, agent: "On-Chain", status: "done" },
    { name: "get_active_addresses", args: `${normSym}, 90d`, agent: "On-Chain", status: "done" },
    { name: "get_news_feed", args: "crypto, 24h", agent: "News", status: "done" },
    { name: "get_etf_flows", args: `${normSym}, 7d`, agent: "News", status: "done" },
    { name: "get_regulatory_updates", args: "SEC, 7d", agent: "News", status: "processing" },
    { name: "get_macro_indicators", args: "CPI, Fed", agent: "News", status: "done" },
  ]

  return (
    <div className="rounded-xl border border-border/80 bg-card/70 p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Wrench className="h-3.5 w-3.5 text-amber-400" />
          <span>Tool Calls</span>{" "}
          <span className="font-mono text-[9px] font-normal text-muted-foreground">(Binance API + Indicators)</span>
        </h3>
        <span className="font-mono text-[9px] text-emerald-400">Total: {toolCallCount}</span>
      </div>

      <div className="max-h-48 space-y-1 overflow-y-auto pr-1 font-mono text-[9px]">
        {tools.map((t, idx) => (
          <div
            key={`${t.name}-${idx}`}
            className="tool-call flex items-center gap-1.5 rounded border border-border/30 bg-background/50 px-2 py-1 transition hover:bg-muted/30"
          >
            <div
              className={t.status === "done" ? "dot-green" : "dot-amber"}
              style={{ width: "5px", height: "5px" }}
            />
            <span className="font-semibold text-cyan-400">{t.name}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">({t.args})</span>
            <span className="text-[8px] text-muted-foreground/70">{t.agent}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
