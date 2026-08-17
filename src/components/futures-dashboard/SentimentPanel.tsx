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
