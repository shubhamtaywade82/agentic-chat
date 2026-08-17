import { useState, useEffect, useRef } from "react"

export interface TickerData {
  symbol: string
  price: number
  changePercent: number
  high: number
  low: number
  volume: number
  direction: "up" | "down" | "neutral"
  updatedAt: number
}

const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]

export function useLiveStream(initialSymbols: string[] = DEFAULT_SYMBOLS) {
  const [symbols, setSymbols] = useState<string[]>(initialSymbols)
  const [tickers, setTickers] = useState<Record<string, TickerData>>({})
  const [wsStatus, setWsStatus] = useState<"connected" | "connecting" | "disconnected">("connecting")
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prevPricesRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (symbols.length === 0) return

    let isSubscribed = true
    const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/")
    const url = `wss://fstream.binance.com/stream?streams=${streams}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (isSubscribed) setWsStatus("connected")
    }

    ws.onmessage = (event) => {
      if (!isSubscribed) return
      try {
        const payload = JSON.parse(event.data)
        const data = payload.data
        if (!data || !data.s) return

        const symbol = data.s.toUpperCase()
        const price = parseFloat(data.c)
        const changePercent = parseFloat(data.P)
        const high = parseFloat(data.h)
        const low = parseFloat(data.l)
        const volume = parseFloat(data.v)
        const prevPrice = prevPricesRef.current[symbol] || price
        const direction: "up" | "down" | "neutral" = price > prevPrice ? "up" : price < prevPrice ? "down" : "neutral"
        prevPricesRef.current[symbol] = price

        setTickers((prev) => ({
          ...prev,
          [symbol]: {
            symbol,
            price,
            changePercent,
            high,
            low,
            volume,
            direction,
            updatedAt: Date.now(),
          },
        }))
      } catch {
        // Ignore ping parse
      }
    }

    ws.onerror = () => {
      if (isSubscribed) setWsStatus("disconnected")
    }

    ws.onclose = () => {
      if (isSubscribed) {
        setWsStatus("disconnected")
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isSubscribed) setWsStatus("connecting")
        }, 4000)
      }
    }

    return () => {
      isSubscribed = false
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      ws.close()
      wsRef.current = null
    }
  }, [symbols])

  const addSymbol = (sym: string) => {
    const clean = sym.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (clean && !symbols.includes(clean)) {
      setSymbols((prev) => [...prev, clean])
    }
  }

  const removeSymbol = (sym: string) => {
    setSymbols((prev) => prev.filter((s) => s !== sym))
    setTickers((prev) => {
      const next = { ...prev }
      delete next[sym]
      return next
    })
  }

  const status = symbols.length === 0 ? "disconnected" : wsStatus

  return {
    status,
    tickers,
    symbols,
    addSymbol,
    removeSymbol,
  }
}
