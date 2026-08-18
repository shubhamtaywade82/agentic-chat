"use client"

import { useEffect, useRef, useState } from "react"
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { useDashboardStore } from "@/store/dashboard-store"
import { useTheme } from "next-themes"
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const INTERVALS = [
  { key: "1m", label: "1m" },
  { key: "5m", label: "5m" },
  { key: "15m", label: "15m" },
  { key: "1h", label: "1h" },
  { key: "4h", label: "4h" },
  { key: "1d", label: "1D" },
]

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]

interface CandleItem {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
  volume: number
}

function getIntervalMs(interval: string): number {
  switch (interval) {
    case "1m": return 60 * 1000
    case "5m": return 5 * 60 * 1000
    case "15m": return 15 * 60 * 1000
    case "1h": return 60 * 60 * 1000
    case "4h": return 4 * 60 * 60 * 1000
    case "1d": return 24 * 60 * 60 * 1000
    default: return 15 * 60 * 1000
  }
}

function calculateEma(data: { time: UTCTimestamp; value: number }[], period: number) {
  const k = 2 / (period + 1)
  const result: { time: UTCTimestamp; value: number }[] = []
  let prevEma = data[0]?.value || 0
  for (let i = 0; i < data.length; i++) {
    const val = i === 0 ? data[i].value : data[i].value * k + prevEma * (1 - k)
    prevEma = val
    if (i >= period - 1) {
      result.push({ time: data[i].time, value: Number(val.toFixed(2)) })
    }
  }
  return result
}

function calculateBollinger(data: { time: UTCTimestamp; value: number }[], period = 20, multiplier = 2) {
  const upper: { time: UTCTimestamp; value: number }[] = []
  const lower: { time: UTCTimestamp; value: number }[] = []

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const mean = slice.reduce((sum, d) => sum + d.value, 0) / period
    const variance = slice.reduce((sum, d) => sum + Math.pow(d.value - mean, 2), 0) / period
    const stdDev = Math.sqrt(variance)

    upper.push({ time: data[i].time, value: Number((mean + multiplier * stdDev).toFixed(2)) })
    lower.push({ time: data[i].time, value: Number((mean - multiplier * stdDev).toFixed(2)) })
  }
  return { upper, lower }
}

function buildChart(container: HTMLElement) {
  return createChart(container, {
    width: container.clientWidth,
    height: 440,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#94a3b8",
    },
    grid: {
      vertLines: { color: "rgba(51, 65, 85, 0.15)" },
      horzLines: { color: "rgba(51, 65, 85, 0.15)" },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: {
      borderColor: "rgba(51, 65, 85, 0.3)",
      autoScale: true,
      scaleMargins: {
        top: 0.1,
        bottom: 0.25,
      },
    },
    timeScale: {
      borderColor: "rgba(51, 65, 85, 0.3)",
      timeVisible: true,
      secondsVisible: false,
    },
  })
}

export function PriceChart() {
  const symbol = useDashboardStore((s) => s.activeSymbol)
  const interval = useDashboardStore((s) => s.interval)
  const showEma9 = useDashboardStore((s) => s.showEma9)
  const showEma21 = useDashboardStore((s) => s.showEma21)
  const showBollinger = useDashboardStore((s) => s.showBollinger)

  const setActiveSymbol = useDashboardStore((s) => s.setActiveSymbol)
  const setInterval_ = useDashboardStore((s) => s.setInterval)
  const setShowEma9 = useDashboardStore((s) => s.setShowEma9)
  const setShowEma21 = useDashboardStore((s) => s.setShowEma21)
  const setShowBollinger = useDashboardStore((s) => s.setShowBollinger)

  const [isLoading, setIsLoading] = useState(true)
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [liveChange, setLiveChange] = useState<number>(0)
  const [tickDirection, setTickDirection] = useState<"up" | "down">("up")
  const [wsStatus, setWsStatus] = useState<"connected" | "connecting" | "disconnected">("connecting")

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const ema9SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const bollUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const bollLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const lastCandleRef = useRef<CandleItem | null>(null)
  const prevPriceRef = useRef<number>(0)

  const isXrp = symbol.toUpperCase().includes("XRP")

  // Chart canvas setup
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = buildChart(container)
    chartRef.current = chart

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat: {
        type: "price",
        precision: isXrp ? 4 : 2,
        minMove: isXrp ? 0.0001 : 0.01,
      },
    })

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    })
    volume.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })
    volumeSeriesRef.current = volume

    ema9SeriesRef.current = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2, title: "EMA 9", priceLineVisible: false })
    ema21SeriesRef.current = chart.addSeries(LineSeries, { color: "#a855f7", lineWidth: 2, title: "EMA 21", priceLineVisible: false })
    bollUpperSeriesRef.current = chart.addSeries(LineSeries, { color: "#06b6d4", lineWidth: 1, lineStyle: LineStyle.Dashed, title: "BB Upper", priceLineVisible: false })
    bollLowerSeriesRef.current = chart.addSeries(LineSeries, { color: "#06b6d4", lineWidth: 1, lineStyle: LineStyle.Dashed, title: "BB Lower", priceLineVisible: false })

    const observer = new ResizeObserver(() => chart && container && chart.applyOptions({ width: container.clientWidth }))
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      lastCandleRef.current = null
    }
  }, [symbol, isXrp])

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== "light"

  // Dynamically update chart styling when light/dark theme toggles
  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.applyOptions({
      layout: {
        textColor: isDark ? "#94a3b8" : "#475569",
      },
      grid: {
        vertLines: { color: isDark ? "rgba(51, 65, 85, 0.15)" : "rgba(226, 232, 240, 0.7)" },
        horzLines: { color: isDark ? "rgba(51, 65, 85, 0.15)" : "rgba(226, 232, 240, 0.7)" },
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.8)",
      },
      timeScale: {
        borderColor: isDark ? "rgba(51, 65, 85, 0.3)" : "rgba(203, 213, 225, 0.8)",
      },
    })
  }, [isDark])

  // Load Historical Klines
  useEffect(() => {
    let cancelled = false

    fetch("/api/futures/klines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, interval, limit: 140 }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success || !Array.isArray(json.data) || !json.data.length) return
        const klines = json.data

        const candleData: CandleItem[] = klines.map((k: { openTime: number; open: number; high: number; low: number; close: number; volume: number }) => ({
          time: Math.floor(k.openTime / 1000) as UTCTimestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
        }))

        const last = candleData[candleData.length - 1]
        lastCandleRef.current = last
        setLivePrice(last.close)

        const volumeData = candleData.map((c) => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)",
        }))

        const closePrices = candleData.map((c) => ({ time: c.time, value: c.close }))
        const ema9 = calculateEma(closePrices, 9)
        const ema21 = calculateEma(closePrices, 21)
        const boll = calculateBollinger(closePrices, 20, 2)

        candleSeriesRef.current?.setData(candleData)
        volumeSeriesRef.current?.setData(volumeData)
        ema9SeriesRef.current?.setData(showEma9 ? ema9 : [])
        ema21SeriesRef.current?.setData(showEma21 ? ema21 : [])
        bollUpperSeriesRef.current?.setData(showBollinger ? boll.upper : [])
        bollLowerSeriesRef.current?.setData(showBollinger ? boll.lower : [])

        chartRef.current?.timeScale().fitContent()
        setIsLoading(false)
      })
      .catch(() => !cancelled && setIsLoading(false))

    return () => {
      cancelled = true
    }
  }, [symbol, interval, showEma9, showEma21, showBollinger])

  // Sub-second trade ticks & 24h ticker WebSocket stream
  useEffect(() => {
    let isSubscribed = true
    const sym = symbol.toLowerCase()
    const url = `wss://stream.binance.com:9443/stream?streams=${sym}@ticker/${sym}@trade`
    const ws = new WebSocket(url)

    const applyTick = (price: number, tradeQty: number) => {
      if (!price || isNaN(price) || price <= 0) return
      const prev = prevPriceRef.current
      if (prev > 0 && price !== prev) {
        setTickDirection(price > prev ? "up" : "down")
      }
      prevPriceRef.current = price
      setLivePrice(price)

      if (!candleSeriesRef.current) return
      const intervalMs = getIntervalMs(interval)
      const currentBucketSec = (Math.floor(Math.floor(Date.now() / intervalMs) * intervalMs / 1000)) as UTCTimestamp
      const last = lastCandleRef.current

      let updated: CandleItem
      if (!last || currentBucketSec > last.time) {
        updated = {
          time: currentBucketSec,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: tradeQty,
        }
      } else {
        updated = {
          time: last.time,
          open: last.open,
          high: Math.max(last.high, price),
          low: Math.min(last.low, price),
          close: price,
          volume: (last.volume || 0) + tradeQty,
        }
      }

      lastCandleRef.current = updated
      candleSeriesRef.current.update({
        time: updated.time,
        open: updated.open,
        high: updated.high,
        low: updated.low,
        close: updated.close,
      })

      if (volumeSeriesRef.current && tradeQty > 0) {
        volumeSeriesRef.current.update({
          time: updated.time,
          value: updated.volume,
          color: updated.close >= updated.open ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)",
        })
      }
    }

    ws.onopen = () => isSubscribed && setWsStatus("connected")
    ws.onmessage = (event) => {
      if (!isSubscribed) return
      try {
        const payload = JSON.parse(event.data)
        const d = payload.data
        if (!d) return

        if (d.e === "trade") {
          // 'd.p' is the actual trade execution price on trade events
          const price = parseFloat(d.p)
          const qty = parseFloat(d.q || 0)
          applyTick(price, qty)
        } else if (d.e === "24hrTicker") {
          // 'd.c' is the last price on 24hrTicker; 'd.p' is price delta ($)
          const price = parseFloat(d.c)
          const changePct = parseFloat(d.P || 0)
          setLiveChange(changePct)
          applyTick(price, 0)
        }
      } catch {
        // Ignore non-JSON or ping frames
      }
    }

    ws.onerror = () => isSubscribed && setWsStatus("disconnected")
    ws.onclose = () => isSubscribed && setWsStatus("disconnected")

    return () => {
      isSubscribed = false
      ws.close()
    }
  }, [symbol, interval])

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3 shadow-xs">
      {/* Top Header: Symbol Selector + LTP + Timeframes */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* Symbol Selector */}
          <div className="relative">
            <select
              value={symbol.toUpperCase()}
              onChange={(e) => setActiveSymbol(e.target.value)}
              className="cursor-pointer appearance-none rounded-lg border border-border bg-background px-3 py-1 pr-7 font-mono text-xs font-bold text-foreground focus:outline-hidden"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>{s.replace("USDT", "/USDT")}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Real-time Sub-Second Live Price & Direction Badge */}
          {livePrice !== null ? (
            <div className="flex items-center gap-2 font-mono">
              <span
                className={cn(
                  "flex items-center gap-0.5 text-base font-bold tabular-nums transition-colors duration-150",
                  tickDirection === "up" ? "text-emerald-400" : "text-red-400"
                )}
              >
                {tickDirection === "up" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                ${livePrice.toLocaleString(undefined, { minimumFractionDigits: isXrp ? 4 : 2, maximumFractionDigits: isXrp ? 4 : 2 })}
              </span>
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums", liveChange >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
                {liveChange >= 0 ? "+" : ""}{liveChange.toFixed(2)}%
              </span>
              <span
                className={cn("h-1.5 w-1.5 rounded-full", wsStatus === "connected" ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40")}
                title={`WebSocket: ${wsStatus}`}
              />
            </div>
          ) : (
            <span className="font-mono text-xs text-muted-foreground animate-pulse">Streaming live trade ticks…</span>
          )}
        </div>

        {/* Timeframe Selectors */}
        <div className="flex gap-1">
          {INTERVALS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setInterval_(key)}
              className={`rounded px-2 py-0.5 font-mono text-[10px] transition ${interval === key ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-muted-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Indicator Legend Bar */}
      <div className="mb-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-xs bg-emerald-400" /> Candlesticks
        </span>
        <label className="flex cursor-pointer items-center gap-1 text-amber-400 hover:opacity-80">
          <input type="checkbox" checked={showEma9} onChange={(e) => setShowEma9(e.target.checked)} className="h-3 w-3 rounded border-border" />
          <span>EMA 9</span>
        </label>
        <label className="flex cursor-pointer items-center gap-1 text-purple-400 hover:opacity-80">
          <input type="checkbox" checked={showEma21} onChange={(e) => setShowEma21(e.target.checked)} className="h-3 w-3 rounded border-border" />
          <span>EMA 21</span>
        </label>
        <label className="flex cursor-pointer items-center gap-1 text-cyan-400 hover:opacity-80">
          <input type="checkbox" checked={showBollinger} onChange={(e) => setShowBollinger(e.target.checked)} className="h-3 w-3 rounded border-border" />
          <span>Bollinger Bands</span>
        </label>
      </div>

      {/* Chart Canvas */}
      <div className="relative h-[440px] w-full overflow-hidden rounded-lg">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-xs font-mono text-xs text-muted-foreground">
            Loading candlestick data…
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
