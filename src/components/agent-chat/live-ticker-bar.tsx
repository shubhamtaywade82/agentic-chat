"use client"

import { useState } from "react"
import { useLiveStream, type TickerData } from "@/lib/use-live-stream"
import { useAgentStore } from "@/store/agent-store"
import {
  TrendingUp, ArrowUpRight, ArrowDownRight, Radio, Plus, X,
  Activity, ExternalLink, Sparkles, BarChart2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function LiveTickerBar() {
  const { tickers, status, symbols, addSymbol, removeSymbol } = useLiveStream()
  const [newSym, setNewSym] = useState("")
  const [openModal, setOpenModal] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState<TickerData | null>(null)
  const sendUserMessage = useAgentStore((s) => s.sendUserMessage)
  const isRunning = useAgentStore((s) => s.isRunning)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSym.trim()) return
    addSymbol(newSym.trim().endsWith("USDT") ? newSym.trim() : `${newSym.trim()}USDT`)
    setNewSym("")
  }

  const handleAskAgent = (t: TickerData) => {
    if (isRunning) return
    sendUserMessage(`Analyze the real-time price action and key levels for ${t.symbol} currently trading at $${t.price.toLocaleString()} (${t.changePercent >= 0 ? "+" : ""}${t.changePercent.toFixed(2)}% 24h).`)
    setOpenModal(false)
  }

  const isConnected = status === "connected"

  return (
    <div className="flex h-8 items-center border-b border-border/80 bg-card/50 px-3 text-xs overflow-x-auto scroll-none gap-2 select-none backdrop-blur-sm">
      {/* Live WS Status Indicator */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/60 hover:bg-muted text-[10px] font-mono shrink-0 transition"
            title="Configure Live WebSocket Streams"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isConnected ? "bg-emerald-500 animate-pulse" : status === "connecting" ? "bg-amber-500" : "bg-zinc-500"
              )}
            />
            <span className="font-semibold text-foreground/90 flex items-center gap-1">
              <Radio className="h-2.5 w-2.5 text-emerald-500" />
              <span>LIVE WS</span>
            </span>
          </button>
        </DialogTrigger>

        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-emerald-500" />
              Live WebSocket Stream Monitor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Real-time tick streams connected via Binance USD-M WebSocket API.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Add symbol form */}
            <form onSubmit={handleAdd} className="flex gap-2">
              <Input
                value={newSym}
                onChange={(e) => setNewSym(e.target.value)}
                placeholder="Add pair (e.g. DOGEUSDT, AVAXUSDT)..."
                className="h-8 text-xs font-mono uppercase"
              />
              <Button type="submit" size="sm" className="h-8 text-xs gap-1">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </form>

            {/* Subscribed pairs list */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {symbols.map((sym) => {
                const t = tickers[sym]
                const isPositive = (t?.changePercent ?? 0) >= 0
                return (
                  <div key={sym} className="flex items-center justify-between p-2 rounded-lg border border-border bg-card/60 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{sym}</span>
                      {t ? (
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span>${t.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <span className={cn("text-[10px] flex items-center", isPositive ? "text-emerald-500" : "text-rose-500")}>
                            {isPositive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                            {t.changePercent.toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground animate-pulse">Waiting for tick...</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {t && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAskAgent(t)}
                          disabled={isRunning}
                          className="h-6 text-[10px] px-2 text-emerald-600 dark:text-emerald-400 gap-1"
                        >
                          <Sparkles className="h-2.5 w-2.5" /> Ask Agent
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSymbol(sym)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Real-time Tickers */}
      <div className="flex items-center gap-3 overflow-x-auto scroll-none py-0.5">
        {symbols.map((sym) => {
          const t = tickers[sym]
          if (!t) return null
          const isPositive = t.changePercent >= 0

          return (
            <button
              key={sym}
              type="button"
              onClick={() => {
                setSelectedTicker(t)
                setOpenModal(true)
              }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-border/40 hover:border-emerald-500/40 bg-card/30 hover:bg-card text-[11px] font-mono transition shrink-0"
            >
              <span className="font-semibold text-foreground/80">{sym.replace("USDT", "")}</span>
              <span
                className={cn(
                  "transition-colors duration-300 font-medium",
                  t.direction === "up" ? "text-emerald-500" : t.direction === "down" ? "text-rose-500" : "text-foreground"
                )}
              >
                ${t.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className={cn("text-[10px] flex items-center", isPositive ? "text-emerald-500" : "text-rose-500")}>
                {isPositive ? "+" : ""}
                {t.changePercent.toFixed(1)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
