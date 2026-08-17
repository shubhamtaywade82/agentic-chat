"use client"

import { useState } from "react"
import { useAgentStore } from "@/store/agent-store"
import type { DhanAuthMode } from "@/lib/agent-types"
import {
  TrendingUp, IndianRupee, CheckCircle2, AlertCircle, Loader2, ShieldCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function TradingTab() {
  const config = useAgentStore((s) => s.config)
  const updateConfig = useAgentStore((s) => s.updateConfig)
  const [dhanTesting, setDhanTesting] = useState(false)
  const [dhanStatus, setDhanStatus] = useState<{ ok?: boolean; msg?: string } | null>(null)

  const testDhanConnection = async () => {
    setDhanTesting(true)
    setDhanStatus(null)
    try {
      const res = await fetch("/api/trading/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "dhan", config: config.dhan }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setDhanStatus({ ok: true, msg: "Connected to DhanHQ successfully!" })
      } else {
        setDhanStatus({ ok: false, msg: data.error || "Authentication failed" })
      }
    } catch {
      setDhanStatus({ ok: false, msg: "Network error testing Dhan" })
    } finally {
      setDhanTesting(false)
    }
  }

  return (
    <div className="space-y-4 py-2 text-xs">
      {/* Binance Section */}
      <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-amber-500/10 text-amber-500">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-foreground">Binance USD-M Futures (Crypto)</p>
              <p className="text-[10px] text-muted-foreground">Public market data via binance-client-ts</p>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1">
            <ShieldCheck className="h-2.5 w-2.5" /> Zero API Key Required
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Provides real-time tickers, OHLCV candlestick klines, depth order books, funding rates, open interest, and long/short account ratios.
        </p>
      </div>

      {/* DhanHQ Section */}
      <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-emerald-500/10 text-emerald-500">
              <IndianRupee className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-foreground">DhanHQ Indian Equity & F&O Markets</p>
              <p className="text-[10px] text-muted-foreground">@shubhamtaywade82/dhanhq-ts live SDK integration</p>
            </div>
          </div>
        </div>

        {/* Option A vs Option B Auth Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => updateConfig({ dhan: { ...config.dhan, authMode: "endpoint" } })}
            className={cn(
              "py-1.5 px-2 rounded-md text-[11px] font-medium transition text-center",
              config.dhan.authMode === "endpoint"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Option B: Auth Endpoint (Auto-fetch)
          </button>
          <button
            type="button"
            onClick={() => updateConfig({ dhan: { ...config.dhan, authMode: "direct" } })}
            className={cn(
              "py-1.5 px-2 rounded-md text-[11px] font-medium transition text-center",
              config.dhan.authMode === "direct"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Option A: Direct Static Token
          </button>
        </div>

        {config.dhan.authMode === "endpoint" ? (
          <div className="space-y-2 pt-1">
            <div>
              <Label className="text-[11px] font-medium mb-1 block">Auth Service Endpoint Base URL</Label>
              <Input
                value={config.dhan.endpointBaseUrl || "https://algo-trading-api.onrender.com"}
                onChange={(e) => updateConfig({ dhan: { ...config.dhan, endpointBaseUrl: e.target.value } })}
                placeholder="https://algo-trading-api.onrender.com"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[11px] font-medium mb-1 block">Bearer Token (optional)</Label>
              <Input
                type="password"
                value={config.dhan.bearerToken || ""}
                onChange={(e) => updateConfig({ dhan: { ...config.dhan, bearerToken: e.target.value } })}
                placeholder="Bearer token for your auth service endpoint..."
                className="h-8 text-xs"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <Label className="text-[11px] font-medium mb-1 block">Dhan Client ID</Label>
              <Input
                value={config.dhan.clientId || ""}
                onChange={(e) => updateConfig({ dhan: { ...config.dhan, clientId: e.target.value } })}
                placeholder="1100..."
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px] font-medium mb-1 block">Dhan Token (JWT)</Label>
              <Input
                type="password"
                value={config.dhan.token || ""}
                onChange={(e) => updateConfig({ dhan: { ...config.dhan, token: e.target.value } })}
                placeholder="ey..."
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Button variant="outline" size="sm" onClick={testDhanConnection} disabled={dhanTesting} className="h-7 text-xs gap-1.5">
            {dhanTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            <span>{dhanTesting ? "Verifying..." : "Test Dhan Connection"}</span>
          </Button>
          {dhanStatus && (
            <span className={cn("text-[11px] flex items-center gap-1", dhanStatus.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
              {dhanStatus.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              <span className="truncate max-w-[260px]">{dhanStatus.msg}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
