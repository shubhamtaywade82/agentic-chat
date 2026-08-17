# Binance Futures Trading Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Binance USD-M futures monitoring dashboard (watchlist, candlestick chart with intraday/swing timeframes, order book, funding/OI/long-short sentiment, positions) at a new `/dashboard` route, alongside the existing Agent Playground.

**Architecture:** Four new server-side API routes wrap the already-installed `binance-client-ts` SDK via the existing `resolveBinanceClient` helper (`src/lib/live-tools.ts`), keeping credentials server-side. Live tick prices reuse the existing `useLiveStream` hook (direct browser WS to Binance, already powers the agent's ticker bar). One new UI dependency, `lightweight-charts`, renders the candlestick chart. `config.binance` from the existing `useAgentStore` is the single credentials source — no second key-entry form.

**Tech Stack:** Next.js App Router (route handlers), React, Zustand (`useAgentStore`), `binance-client-ts` SDK, `lightweight-charts` (new), existing shadcn/ui primitives (`Card`, `Tabs`, `Skeleton`).

**Spec:** `docs/superpowers/specs/2026-08-17-futures-dashboard-design.md`

## Global Constraints

- Read-only scope only. No order placement/modification/cancellation UI. (spec: Scope)
- Reuse `resolveBinanceClient` from `src/lib/live-tools.ts` in every new route — do not re-implement the SDK default-export unwrap logic. (spec: Architecture)
- Reuse `src/lib/use-live-stream.ts` for live ticks — do not open a second WS connection. (spec: Architecture)
- Reuse `config.binance` from `useAgentStore` — no second credentials form. (spec: Architecture)
- New dependency: `lightweight-charts` only. No other new packages. (spec: Architecture)
- **Deviation from spec's route table:** the spec listed routes as `GET /api/futures/klines?symbol=...`. Implementing that literally would put `binance.apiSecret` in a URL query string for the positions route, which violates the standing rule "never place personal or sensitive data in URL parameters or query strings." All four routes are **POST with a JSON body** instead (`{ symbol, interval?, limit?, binance? }`), matching the existing `src/app/api/trading/test/route.ts` pattern already in this codebase. Functionality and endpoint paths are unchanged from the spec — only the HTTP method/param transport.
- No test framework exists in this repo. API routes are verified with `curl` against the running dev server (`localhost:3400`); components are verified with `tsc --noEmit` + a manual Chrome pass. Do not introduce a test framework. (spec: Testing)
- Each panel owns its own loading/error/empty state; one panel failing must not blank the rest of the dashboard. (spec: Error Handling)

---

### Task 1: `/api/futures/klines` route

**Files:**
- Create: `src/app/api/futures/klines/route.ts`

**Interfaces:**
- Consumes: `resolveBinanceClient` from `@/lib/live-tools`; `BinanceConfig` type from `@/lib/agent-types`
- Produces: `POST /api/futures/klines` accepting `{ symbol: string, interval?: string, limit?: number, binance?: BinanceConfig }`, returning `{ success: true, data: Kline[] }` or `{ success: false, error: string }`. Per the SDK's `KlineSchema`, each `Kline` is already a parsed **object** (not a tuple) with numeric fields coerced: `{ openTime: number, open: number, high: number, low: number, close: number, volume: number, closeTime: number, quoteAssetVolume: number, trades: number, takerBuyBaseVolume: number, takerBuyQuoteVolume: number }`. Consumed as-is by Task 7's `PriceChart`.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { resolveBinanceClient } from "@/lib/live-tools"
import type { BinanceConfig } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  try {
    const { symbol, interval = "1h", limit = 100, binance } = (await req.json()) as {
      symbol: string
      interval?: string
      limit?: number
      binance?: BinanceConfig
    }

    if (!symbol) {
      return NextResponse.json({ success: false, error: "symbol is required" }, { status: 400 })
    }

    const client = resolveBinanceClient(binance)
    const cleanSymbol = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    const data = await client.futures.market.klines(
      cleanSymbol,
      interval as "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M",
      { limit }
    )

    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `api/futures/klines`

- [ ] **Step 3: Verify against the running dev server**

Run:
```bash
curl -s -X POST localhost:3400/api/futures/klines \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","interval":"1h","limit":5}' | head -c 400
```
Expected: JSON with `"success":true` and a `"data"` array of 5 objects, each with `"openTime"`, `"open"`, `"high"`, `"low"`, `"close"` as numbers (not strings, not arrays)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/futures/klines/route.ts
git commit -m "Add futures klines API route for candlestick chart data"
```

---

### Task 2: `/api/futures/depth` route

**Files:**
- Create: `src/app/api/futures/depth/route.ts`

**Interfaces:**
- Consumes: `resolveBinanceClient` from `@/lib/live-tools`; `BinanceConfig` from `@/lib/agent-types`
- Produces: `POST /api/futures/depth` accepting `{ symbol: string, limit?: number, binance?: BinanceConfig }`, returning `{ success: true, data: { lastUpdateId: number, bids: [string, string][], asks: [string, string][] } }` or `{ success: false, error: string }`. Consumed by Task 10's `OrderBookPanel`.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { resolveBinanceClient } from "@/lib/live-tools"
import type { BinanceConfig } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  try {
    const { symbol, limit = 20, binance } = (await req.json()) as {
      symbol: string
      limit?: number
      binance?: BinanceConfig
    }

    if (!symbol) {
      return NextResponse.json({ success: false, error: "symbol is required" }, { status: 400 })
    }

    const client = resolveBinanceClient(binance)
    const cleanSymbol = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    const data = await client.futures.market.depth(cleanSymbol, limit)

    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `api/futures/depth`

- [ ] **Step 3: Verify against the running dev server**

Run:
```bash
curl -s -X POST localhost:3400/api/futures/depth \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","limit":5}' | head -c 400
```
Expected: JSON with `"success":true`, `"data.bids"` and `"data.asks"` each a 5-item array of `[price, quantity]` string pairs

- [ ] **Step 4: Commit**

```bash
git add src/app/api/futures/depth/route.ts
git commit -m "Add futures depth API route for order book panel"
```

---

### Task 3: `/api/futures/sentiment` route

**Files:**
- Create: `src/app/api/futures/sentiment/route.ts`

**Interfaces:**
- Consumes: `resolveBinanceClient` from `@/lib/live-tools`; `BinanceConfig` from `@/lib/agent-types`
- Produces: `POST /api/futures/sentiment` accepting `{ symbol: string, binance?: BinanceConfig }`, returning `{ success: true, data: { fundingRate: { symbol: string, fundingTime: number, fundingRate: number, markPrice?: number }[], openInterest: { symbol: string, openInterest: number, time: number }, longShortRatio: { symbol: string, longShortRatio: number, longAccount: number, shortAccount: number, timestamp: number }[] } }`. Consumed by Task 8's `SentimentPanel`.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { resolveBinanceClient } from "@/lib/live-tools"
import type { BinanceConfig } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  try {
    const { symbol, binance } = (await req.json()) as {
      symbol: string
      binance?: BinanceConfig
    }

    if (!symbol) {
      return NextResponse.json({ success: false, error: "symbol is required" }, { status: 400 })
    }

    const client = resolveBinanceClient(binance)
    const cleanSymbol = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

    const [fundingRate, openInterest, longShortRatio] = await Promise.all([
      client.futures.data.fundingRateHistory(cleanSymbol, { limit: 5 }),
      client.futures.data.openInterest(cleanSymbol),
      client.futures.data.globalLongShortAccountRatio(cleanSymbol, "1h", 5),
    ])

    return NextResponse.json({ success: true, data: { fundingRate, openInterest, longShortRatio } })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `api/futures/sentiment`

- [ ] **Step 3: Verify against the running dev server**

Run:
```bash
curl -s -X POST localhost:3400/api/futures/sentiment \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT"}' | head -c 500
```
Expected: JSON with `"success":true` and `"data.fundingRate"` (array), `"data.openInterest"` (object with `"openInterest"` number), `"data.longShortRatio"` (array)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/futures/sentiment/route.ts
git commit -m "Add futures sentiment API route (funding rate, OI, long/short ratio)"
```

---

### Task 4: `/api/futures/positions` route

**Files:**
- Create: `src/app/api/futures/positions/route.ts`

**Interfaces:**
- Consumes: `resolveBinanceClient` from `@/lib/live-tools`; `BinanceConfig` from `@/lib/agent-types`
- Produces: `POST /api/futures/positions` accepting `{ binance?: BinanceConfig }`, returning `{ success: true, data: PositionRisk[] }` where each item has `{ symbol, positionAmt, entryPrice, markPrice, unRealizedProfit, liquidationPrice, leverage, marginType, positionSide, notional }` (all numeric fields already coerced from strings by the SDK). Only positions with non-zero `positionAmt` are open positions. Consumed by Task 9's `PositionsPanel`. If `binance.apiKey` is empty, this route is not called by the client at all (handled client-side in Task 9) — but the route itself still requires a valid signed request if called, and returns a 500 with the SDK's auth error if credentials are missing/invalid.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { resolveBinanceClient } from "@/lib/live-tools"
import type { BinanceConfig } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  try {
    const { binance } = (await req.json()) as { binance?: BinanceConfig }

    if (!binance?.apiKey || !binance?.apiSecret) {
      return NextResponse.json(
        { success: false, error: "Binance API key and secret are required to view positions" },
        { status: 400 }
      )
    }

    const client = resolveBinanceClient(binance)
    const allPositions = await client.futures.account.positionRisk()
    const openPositions = allPositions.filter((p) => p.positionAmt !== 0)

    return NextResponse.json({ success: true, data: openPositions })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `api/futures/positions`

- [ ] **Step 3: Verify against the running dev server**

Run:
```bash
curl -s -X POST localhost:3400/api/futures/positions \
  -H "Content-Type: application/json" \
  -d '{}' | head -c 300
```
Expected: `{"success":false,"error":"Binance API key and secret are required to view positions"}` (no key sent — confirms the guard works without needing real credentials for this check)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/futures/positions/route.ts
git commit -m "Add futures positions API route for read-only PnL panel"
```

---

### Task 5: Dashboard shell, route, and nav links

**Files:**
- Create: `src/components/futures-dashboard/FuturesDashboard.tsx`
- Create: `src/app/dashboard/page.tsx`
- Modify: `src/components/agent-chat/index.tsx` (add a "Dashboard" link in the header)

**Interfaces:**
- Produces: `FuturesDashboard` component with internal `activeSymbol: string` state (default `"BTCUSDT"`) and `setActiveSymbol: (s: string) => void`, passed as props to child panels added in Tasks 6-10. Also produces the `/dashboard` route.
- Consumes: `next/link`'s `Link` for navigation.

- [ ] **Step 1: Write the dashboard shell component**

```typescript
"use client"

import { useState } from "react"
import Link from "next/link"
import { LineChart, ArrowLeft } from "lucide-react"

export function FuturesDashboard() {
  const [activeSymbol, setActiveSymbol] = useState("BTCUSDT")

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Agent
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <LineChart className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold">Futures Dashboard</h1>
            <p className="hidden text-[10px] text-muted-foreground sm:block">
              Binance USD-M · {activeSymbol} · intraday & swing
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_300px]">
          <div id="dashboard-watchlist-slot" />
          <div className="space-y-4">
            <div id="dashboard-chart-slot" />
            <div id="dashboard-orderbook-slot" />
          </div>
          <div className="space-y-4">
            <div id="dashboard-sentiment-slot" />
            <div id="dashboard-positions-slot" />
          </div>
        </div>
      </div>
    </div>
  )
}
```

Note: the `id="dashboard-*-slot"` divs are placeholders replaced by real components in Tasks 6-10 (each task edits this file to swap a placeholder div for its component). They exist so this task's page renders a real, inspectable layout immediately.

- [ ] **Step 2: Write the route page**

```typescript
"use client"

import { FuturesDashboard } from "@/components/futures-dashboard/FuturesDashboard"

export default function DashboardPage() {
  return <FuturesDashboard />
}
```

- [ ] **Step 3: Add the nav link in the agent header**

In `src/components/agent-chat/index.tsx`, add the import:

```typescript
import Link from "next/link"
import { LineChart } from "lucide-react"
```

Then in the header's `<div className="ml-auto flex items-center gap-2">` block, add this as the first child (before the "Real LLM" badge):

```typescript
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs">
              <LineChart className="h-3 w-3 text-muted-foreground" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </Link>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 5: Verify in Chrome**

Navigate to `localhost:3400/dashboard`. Expected: header shows "← Agent" link and "Futures Dashboard" title with "BTCUSDT" in the subtitle; a 3-column empty grid layout is visible. Navigate to `localhost:3400/`. Expected: a "Dashboard" button now appears in the header next to "Real LLM". Click it, confirm it navigates to `/dashboard`.

- [ ] **Step 6: Commit**

```bash
git add src/components/futures-dashboard/FuturesDashboard.tsx src/app/dashboard/page.tsx src/components/agent-chat/index.tsx
git commit -m "Add futures dashboard shell, route, and nav link"
```

---

### Task 6: Watchlist panel

**Files:**
- Create: `src/components/futures-dashboard/Watchlist.tsx`
- Modify: `src/components/futures-dashboard/FuturesDashboard.tsx`

**Interfaces:**
- Consumes: `useLiveStream` from `@/lib/use-live-stream` (existing hook — `TickerData` shape: `{ symbol, price, changePercent, high, low, volume, direction, updatedAt }`)
- Produces: `Watchlist({ activeSymbol, onSelect }: { activeSymbol: string, onSelect: (symbol: string) => void })` — renders live ticks, calls `onSelect(symbol)` on row click.

- [ ] **Step 1: Write the Watchlist component**

```typescript
"use client"

import { useLiveStream } from "@/lib/use-live-stream"
import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

export function Watchlist({ activeSymbol, onSelect }: { activeSymbol: string; onSelect: (symbol: string) => void }) {
  const { status, tickers, symbols } = useLiveStream()

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Watchlist</h3>
        <span className={cn("h-1.5 w-1.5 rounded-full", status === "connected" ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      </div>
      <div className="space-y-1">
        {symbols.map((symbol) => {
          const t = tickers[symbol]
          const isActive = symbol === activeSymbol
          return (
            <button
              key={symbol}
              onClick={() => onSelect(symbol)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition",
                isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <span className="font-mono">{symbol}</span>
              {t ? (
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  {t.direction === "up" ? (
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                  ) : t.direction === "down" ? (
                    <ArrowDown className="h-3 w-3 text-red-500" />
                  ) : (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span>${t.price.toLocaleString()}</span>
                  <span className={t.changePercent >= 0 ? "text-emerald-500" : "text-red-500"}>
                    {t.changePercent >= 0 ? "+" : ""}{t.changePercent.toFixed(2)}%
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground/50">loading…</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the dashboard shell**

In `FuturesDashboard.tsx`, add the import:

```typescript
import { Watchlist } from "./Watchlist"
```

Replace `<div id="dashboard-watchlist-slot" />` with:

```typescript
<Watchlist activeSymbol={activeSymbol} onSelect={setActiveSymbol} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 4: Verify in Chrome**

Navigate to `localhost:3400/dashboard`. Expected: left column shows a watchlist with `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, `XRPUSDT`, live prices updating within a few seconds, green dot once connected. Click `ETHUSDT`. Expected: the header subtitle updates from "BTCUSDT" to "ETHUSDT" and the `ETHUSDT` row highlights.

- [ ] **Step 5: Commit**

```bash
git add src/components/futures-dashboard/Watchlist.tsx src/components/futures-dashboard/FuturesDashboard.tsx
git commit -m "Add live watchlist panel to futures dashboard"
```

---

### Task 7: Price chart panel (candlesticks, intraday/swing tabs)

**Files:**
- Modify: `package.json` (add `lightweight-charts`)
- Create: `src/components/futures-dashboard/PriceChart.tsx`
- Modify: `src/components/futures-dashboard/FuturesDashboard.tsx`

**Interfaces:**
- Consumes: `POST /api/futures/klines` from Task 1
- Produces: `PriceChart({ symbol }: { symbol: string })` — self-contained, owns its own timeframe-tab state and fetch/loading/error state.

- [ ] **Step 1: Install the dependency**

Run: `npm install lightweight-charts`
Expected: `package.json` gains a `"lightweight-charts": "^..."` entry under `dependencies`

- [ ] **Step 2: Write the PriceChart component**

```typescript
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

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
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
```

- [ ] **Step 3: Wire it into the dashboard shell**

In `FuturesDashboard.tsx`, add the import:

```typescript
import { PriceChart } from "./PriceChart"
```

Replace `<div id="dashboard-chart-slot" />` with:

```typescript
<PriceChart symbol={activeSymbol} />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 5: Verify in Chrome**

Navigate to `localhost:3400/dashboard`. Expected: a candlestick chart renders for BTCUSDT within a few seconds. Click the "Swing" tab. Expected: interval buttons switch to `4h`/`1d`/`1w`, chart refetches and redraws. Click `1d`. Expected: chart shows daily candles. Click `ETHUSDT` in the watchlist. Expected: chart title updates to "ETHUSDT Price Chart" and redraws with ETH data.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/futures-dashboard/PriceChart.tsx src/components/futures-dashboard/FuturesDashboard.tsx
git commit -m "Add candlestick price chart with intraday/swing timeframes"
```

---

### Task 8: Sentiment panel (funding rate, open interest, long/short ratio)

**Files:**
- Create: `src/components/futures-dashboard/SentimentPanel.tsx`
- Modify: `src/components/futures-dashboard/FuturesDashboard.tsx`

**Interfaces:**
- Consumes: `POST /api/futures/sentiment` from Task 3
- Produces: `SentimentPanel({ symbol }: { symbol: string })`

- [ ] **Step 1: Write the SentimentPanel component**

```typescript
"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface SentimentData {
  fundingRate: { fundingRate: number; fundingTime: number }[]
  openInterest: { openInterest: number }
  longShortRatio: { longShortRatio: number; longAccount: number; shortAccount: number }[]
}

export function SentimentPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<SentimentData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetch("/api/futures/sentiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (!json.success) throw new Error(json.error || "Failed to load sentiment")
        setData(json.data)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
  }, [symbol])

  const latestFunding = data?.fundingRate[data.fundingRate.length - 1]
  const latestRatio = data?.longShortRatio[data.longShortRatio.length - 1]

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{symbol} Sentiment</h3>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      {!data && !error && <Skeleton className="h-24 w-full" />}
      {data && (
        <div className="space-y-2 text-xs">
          <Row label="Funding Rate" value={latestFunding ? `${(latestFunding.fundingRate * 100).toFixed(4)}%` : "—"} />
          <Row label="Open Interest" value={data.openInterest.openInterest.toLocaleString()} />
          <Row label="Long/Short Ratio" value={latestRatio ? latestRatio.longShortRatio.toFixed(2) : "—"} />
          {latestRatio && (
            <Row label="Long / Short %" value={`${(latestRatio.longAccount * 100).toFixed(1)}% / ${(latestRatio.shortAccount * 100).toFixed(1)}%`} />
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the dashboard shell**

In `FuturesDashboard.tsx`, add the import:

```typescript
import { SentimentPanel } from "./SentimentPanel"
```

Replace `<div id="dashboard-sentiment-slot" />` with:

```typescript
<SentimentPanel symbol={activeSymbol} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 4: Verify in Chrome**

Navigate to `localhost:3400/dashboard`. Expected: right column shows a "BTCUSDT Sentiment" panel with Funding Rate, Open Interest, Long/Short Ratio, and Long/Short % rows populated with real numbers within a couple seconds. Click `SOLUSDT` in watchlist. Expected: panel title updates to "SOLUSDT Sentiment" and values refresh.

- [ ] **Step 5: Commit**

```bash
git add src/components/futures-dashboard/SentimentPanel.tsx src/components/futures-dashboard/FuturesDashboard.tsx
git commit -m "Add sentiment panel (funding rate, open interest, long/short ratio)"
```

---

### Task 9: Positions panel

**Files:**
- Create: `src/components/futures-dashboard/PositionsPanel.tsx`
- Modify: `src/components/futures-dashboard/FuturesDashboard.tsx`

**Interfaces:**
- Consumes: `POST /api/futures/positions` from Task 4; `useAgentStore` for `config.binance`
- Produces: `PositionsPanel()` (no props — reads its own symbol-agnostic account-wide position list from the store's Binance config)

- [ ] **Step 1: Write the PositionsPanel component**

```typescript
"use client"

import { useEffect, useState } from "react"
import { useAgentStore } from "@/store/agent-store"
import { Skeleton } from "@/components/ui/skeleton"

interface Position {
  symbol: string
  positionAmt: number
  entryPrice: number
  markPrice: number
  unRealizedProfit: number
  leverage: number
  positionSide: string
}

export function PositionsPanel() {
  const binanceConfig = useAgentStore((s) => s.config.binance)
  const [positions, setPositions] = useState<Position[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!binanceConfig?.apiKey || !binanceConfig?.apiSecret) {
      setPositions(null)
      setError(null)
      return
    }
    let cancelled = false
    fetch("/api/futures/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ binance: binanceConfig }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (!json.success) throw new Error(json.error || "Failed to load positions")
        setPositions(json.data)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
  }, [binanceConfig])

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Open Positions</h3>
      {!binanceConfig?.apiKey || !binanceConfig?.apiSecret ? (
        <p className="text-[10px] text-muted-foreground">
          Add a Binance API key in Agent Config to see live positions.
        </p>
      ) : error ? (
        <p className="text-[10px] text-red-500">{error}</p>
      ) : positions === null ? (
        <Skeleton className="h-16 w-full" />
      ) : positions.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">No open positions.</p>
      ) : (
        <div className="space-y-2">
          {positions.map((p) => (
            <div key={`${p.symbol}-${p.positionSide}`} className="rounded-lg border border-border/60 bg-background/50 p-2 text-xs">
              <div className="flex items-center justify-between font-mono">
                <span className="font-semibold">{p.symbol}</span>
                <span className={p.unRealizedProfit >= 0 ? "text-emerald-500" : "text-red-500"}>
                  {p.unRealizedProfit >= 0 ? "+" : ""}{p.unRealizedProfit.toFixed(2)} USDT
                </span>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{p.positionAmt > 0 ? "LONG" : "SHORT"} {Math.abs(p.positionAmt)} @ {p.entryPrice}</span>
                <span>{p.leverage}x</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the dashboard shell**

In `FuturesDashboard.tsx`, add the import:

```typescript
import { PositionsPanel } from "./PositionsPanel"
```

Replace `<div id="dashboard-positions-slot" />` with:

```typescript
<PositionsPanel />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 4: Verify in Chrome**

Navigate to `localhost:3400/dashboard`. If no Binance API key is configured in Agent Config: expected the "Open Positions" panel shows "Add a Binance API key in Agent Config to see live positions." with no network error. If a key is configured: expected either "No open positions." or a list of position cards with symbol, unrealized PnL (green/red), side, size, entry price, and leverage.

- [ ] **Step 5: Commit**

```bash
git add src/components/futures-dashboard/PositionsPanel.tsx src/components/futures-dashboard/FuturesDashboard.tsx
git commit -m "Add read-only positions panel with PnL"
```

---

### Task 10: Order book panel

**Files:**
- Create: `src/components/futures-dashboard/OrderBookPanel.tsx`
- Modify: `src/components/futures-dashboard/FuturesDashboard.tsx`

**Interfaces:**
- Consumes: `POST /api/futures/depth` from Task 2
- Produces: `OrderBookPanel({ symbol }: { symbol: string })`

- [ ] **Step 1: Write the OrderBookPanel component**

```typescript
"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface DepthData {
  bids: [string, string][]
  asks: [string, string][]
}

export function OrderBookPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<DepthData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetch("/api/futures/depth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, limit: 10 }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (!json.success) throw new Error(json.error || "Failed to load order book")
        setData(json.data)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    const timer = window.setInterval(() => {
      fetch("/api/futures/depth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, limit: 10 }),
      })
        .then((res) => res.json())
        .then((json) => !cancelled && json.success && setData(json.data))
        .catch(() => {})
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [symbol])

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{symbol} Order Book</h3>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      {!data && !error && <Skeleton className="h-40 w-full" />}
      {data && (
        <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
          <div>
            <div className="mb-1 text-muted-foreground">Bids</div>
            {data.bids.map(([price, qty]) => (
              <div key={price} className="flex justify-between text-emerald-500">
                <span>{Number(price).toLocaleString()}</span>
                <span>{Number(qty).toFixed(3)}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 text-muted-foreground">Asks</div>
            {data.asks.map(([price, qty]) => (
              <div key={price} className="flex justify-between text-red-500">
                <span>{Number(price).toLocaleString()}</span>
                <span>{Number(qty).toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the dashboard shell**

In `FuturesDashboard.tsx`, add the import:

```typescript
import { OrderBookPanel } from "./OrderBookPanel"
```

Replace `<div id="dashboard-orderbook-slot" />` with:

```typescript
<OrderBookPanel symbol={activeSymbol} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 4: Verify in Chrome**

Navigate to `localhost:3400/dashboard`. Expected: below the chart, an order book panel shows 10 bid rows (green) and 10 ask rows (red) with price/quantity for BTCUSDT. Click `XRPUSDT` in the watchlist. Expected: order book title updates and refreshes with XRP data.

- [ ] **Step 5: Commit**

```bash
git add src/components/futures-dashboard/OrderBookPanel.tsx src/components/futures-dashboard/FuturesDashboard.tsx
git commit -m "Add order book depth panel to futures dashboard"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only)

**Interfaces:** none — this task exercises the full assembled dashboard from Tasks 1-10.

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: zero errors across the whole project

- [ ] **Step 2: Confirm dev server is healthy**

Run: `curl -s localhost:3400/dashboard -o /dev/null -w "%{http_code}\n"`
Expected: `200`

- [ ] **Step 3: Full symbol-propagation check in Chrome**

Navigate to `localhost:3400/dashboard`. Click `ETHUSDT` in the watchlist. Expected: header subtitle, chart title, sentiment panel title, and order book title all update to `ETHUSDT` together (confirms `activeSymbol` propagates to every panel, not just some).

- [ ] **Step 4: Intraday/swing check**

On the price chart, click "Swing" then `1d`. Expected: chart redraws with daily candles, no console errors.

- [ ] **Step 5: Console error check**

Use the browser console reader (or DevTools) filtered for `error`. Expected: no errors originating from `/dashboard` or `/api/futures/*` (ignore unrelated extension noise, as seen previously with the agent playground's "message channel closed" errors).

- [ ] **Step 6: Nav round-trip check**

From `/dashboard`, click "← Agent". Expected: lands on `/` with the Agent Playground intact (chat sessions sidebar, agent runtime panel, existing functionality unaffected by the dashboard addition).

- [ ] **Step 7: Final commit (only if any fixes were needed in prior steps)**

```bash
git add -A
git commit -m "Fix issues found in futures dashboard end-to-end verification"
```

If no fixes were needed, skip this step — there's nothing to commit.
