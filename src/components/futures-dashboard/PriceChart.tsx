"use client"

import { useEffect, useRef, useState } from "react"
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

const INTRADAY_INTERVALS = ["1m", "5m", "15m", "1h"] as const
const SWING_INTERVALS = ["4h", "1d", "1w"] as const

interface Kline {
  openTime: number
  open: number
  high: number
  low: number
  close: number
}

export function PriceChart({ symbol }: { symbol: string }) {
  const [mode, setMode] = useState<"intraday" | "swing">("intraday")
  const [interval, setInterval_] = useState<string>("1h")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      height: 360,
      layout: { background: { color: "transparent" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      timeScale: { timeVisible: true },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#ef4444", borderVisible: false,
      wickUpColor: "#10b981", wickDownColor: "#ef4444",
    })
    chartRef.current = chart
    seriesRef.current = series

    // Container is `hidden` (display:none) while loading, so clientWidth is 0
    // at mount time; a plain window-resize listener never fires again once the
    // skeleton is swapped out. ResizeObserver fires when the container's box
    // appears (hidden -> visible), so it catches that transition correctly.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) chart.applyOptions({ width })
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/futures/klines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, interval, limit: 200 }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "Failed to load klines")
        if (cancelled) return
        const rows = json.data as Kline[]
        const candles = rows.map((r) => ({
          time: Math.floor(r.openTime / 1000) as UTCTimestamp,
          open: r.open, high: r.high, low: r.low, close: r.close,
        }))
        seriesRef.current?.setData(candles)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const timer = window.setInterval(load, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [symbol, interval])

  const intervals = mode === "intraday" ? INTRADAY_INTERVALS : SWING_INTERVALS

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{symbol} Price Chart</h3>
        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={(v) => { setMode(v as "intraday" | "swing"); setInterval_(v === "intraday" ? "1h" : "1d") }}>
            <TabsList className="h-6">
              <TabsTrigger value="intraday" className="h-5 text-[10px]">Intraday</TabsTrigger>
              <TabsTrigger value="swing" className="h-5 text-[10px]">Swing</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-1">
            {intervals.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval_(iv)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition ${
                  interval === iv ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {iv}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="mb-2 text-[10px] text-red-500">{error}</p>}
      {loading && !error && <Skeleton className="h-[360px] w-full" />}
      <div ref={containerRef} className={loading ? "hidden" : "w-full"} />
    </div>
  )
}
