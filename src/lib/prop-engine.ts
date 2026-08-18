import { resolveBinanceClient } from "./live-tools"
import type { BinanceConfig } from "./agent-types"
import {
  detectFVGs,
  detectOrderBlocks,
  detectMarketStructure,
  detectLiquidityPools,
  detectPremiumDiscount,
  detectSupplyDemandZones,
  detectTrendlineLiquidity,
  detectCandlestickPatterns,
  detectICTSessions,
  detectSilverBulletWindows,
  detectICTOTEZone,
  detectJudasSwings,
  detectAMDCycles,
  scanSetups,
  type CandleData,
  type HtfBias,
} from "chart-sdk/core"

export interface PropTradeSetup {
  symbol: string
  mode: "intraday" | "swing"
  direction: "LONG" | "SHORT" | "NO_TRADE"
  bias: "bullish" | "bearish" | "neutral"
  confluenceScore: number
  alignedFactors: string[]
  currentPrice: number
  entry: { price: number; zoneLow: number; zoneHigh: number; rationale: string }
  stopLoss: { price: number; distancePct: number; rationale: string }
  takeProfits: { level: number; price: number; rrr: number; pctGain: number; rationale: string }[]
  riskRewardRatio: number
  regime: { isTrending: boolean; adx: number; chopIndex: number; label: string }
  invalidation: string
  summaryMarkdown: string
}

export const DEFAULT_PROP_WATCHLIST = ["SOLUSDT", "ETHUSDT", "XRPUSDT", "BTCUSDT"]

// Converts raw Binance Kline objects to chart-sdk CandleData format
function toCandleData(rows: any[]): CandleData[] {
  return rows.map((r) => ({
    time: Math.floor((r.openTime || r.time || 0) / 1000),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume || 0),
  }))
}

// Fetch klines from Binance USD-M client with public REST fallback
export async function fetchKlines(
  symbol: string,
  interval: string,
  limit = 120,
  config?: BinanceConfig
): Promise<CandleData[]> {
  const clean = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  try {
    const client = resolveBinanceClient(config)
    const raw = await client.futures.market.klines(clean as any, interval as any, { limit })
    if (Array.isArray(raw) && raw.length > 0) return toCandleData(raw)
  } catch {
    // Public Binance Futures REST fallback when client is throttled or unauthenticated
  }

  const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${clean}&interval=${interval}&limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to fetch klines for ${clean} (${interval})`)
  const rows = await res.json()
  return rows.map((k: any) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }))
}

// Computes 14-period Choppiness Index (Dreiss Fractal Dimension)
function calculateChop(candles: CandleData[]): number {
  if (candles.length < 15) return 50
  const slice = candles.slice(-15)
  let trSum = 0
  let maxH = -Infinity
  let minL = Infinity
  for (let i = 1; i < slice.length; i++) {
    const c = slice[i]
    const p = slice[i - 1]
    trSum += Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close))
    if (c.high > maxH) maxH = c.high
    if (c.low < minL) minL = c.low
  }
  const range = maxH - minL
  return range > 0 && trSum > 0 ? Number((100 * (Math.log10(trSum / range) / Math.log10(14))).toFixed(1)) : 50
}

// Builds higher-timeframe bias structures
function buildHtfBias(candles: CandleData[], label: string): HtfBias {
  return {
    tfLabel: label,
    structure: detectMarketStructure(candles),
    amd: detectAMDCycles(candles),
    liquidity: detectLiquidityPools(candles),
    judas: detectJudasSwings(candles),
  }
}

// Calculates long setup targets and invalidation
function buildLongPlan(price: number, demandOb: any, sweep: any, targetBsl: any) {
  const stop = demandOb ? demandOb.bottom * 0.998 : price * 0.985
  const risk = Math.max(0.0001, price - stop)
  const tp1 = price + risk * 1.5
  const tp2 = targetBsl ? targetBsl.level : price + risk * 2.8
  const tp3 = price + risk * 4.5
  const rrr = Number(((tp2 - price) / risk).toFixed(2))

  return {
    entry: {
      price,
      zoneLow: demandOb ? demandOb.bottom : stop,
      zoneHigh: demandOb ? demandOb.top : price,
      rationale: demandOb ? `Demand Order Block tap (${demandOb.bottom.toFixed(2)}-${demandOb.top.toFixed(2)})` : "Momentum retrace entry",
    },
    stopLoss: {
      price: Number(stop.toFixed(4)),
      distancePct: Number((((price - stop) / price) * 100).toFixed(2)),
      rationale: `Invalidation below swing demand (${stop.toFixed(2)})`,
    },
    takeProfits: [
      { level: 1, price: Number(tp1.toFixed(4)), rrr: 1.5, pctGain: Number((((tp1 - price) / price) * 100).toFixed(2)), rationale: "Take 40% & move SL to BE" },
      { level: 2, price: Number(tp2.toFixed(4)), rrr, pctGain: Number((((tp2 - price) / price) * 100).toFixed(2)), rationale: "Untapped BSL liquidity pool" },
      { level: 3, price: Number(tp3.toFixed(4)), rrr: 4.5, pctGain: Number((((tp3 - price) / price) * 100).toFixed(2)), rationale: "Macro range expansion target" },
    ],
    riskRewardRatio: rrr,
    invalidation: `15m candle body close below ${stop.toFixed(2)} invalidates setup`,
  }
}

// Calculates short setup targets and invalidation
function buildShortPlan(price: number, supplyOb: any, sweep: any, targetSsl: any) {
  const stop = supplyOb ? supplyOb.top * 1.002 : price * 1.015
  const risk = Math.max(0.0001, stop - price)
  const tp1 = price - risk * 1.5
  const tp2 = targetSsl ? targetSsl.level : price - risk * 2.8
  const tp3 = price - risk * 4.5
  const rrr = Number(((price - tp2) / risk).toFixed(2))

  return {
    entry: {
      price,
      zoneLow: supplyOb ? supplyOb.bottom : price,
      zoneHigh: supplyOb ? supplyOb.top : stop,
      rationale: supplyOb ? `Supply Order Block tap (${supplyOb.bottom.toFixed(2)}-${supplyOb.top.toFixed(2)})` : "Momentum reject entry",
    },
    stopLoss: {
      price: Number(stop.toFixed(4)),
      distancePct: Number((((stop - price) / price) * 100).toFixed(2)),
      rationale: `Invalidation above swing supply (${stop.toFixed(2)})`,
    },
    takeProfits: [
      { level: 1, price: Number(tp1.toFixed(4)), rrr: 1.5, pctGain: Number((((price - tp1) / price) * 100).toFixed(2)), rationale: "Take 40% & move SL to BE" },
      { level: 2, price: Number(tp2.toFixed(4)), rrr, pctGain: Number((((price - tp2) / price) * 100).toFixed(2)), rationale: "Untapped SSL liquidity pool" },
      { level: 3, price: Number(tp3.toFixed(4)), rrr: 4.5, pctGain: Number((((price - tp3) / price) * 100).toFixed(2)), rationale: "Macro range expansion target" },
    ],
    riskRewardRatio: rrr,
    invalidation: `15m candle body close above ${stop.toFixed(2)} invalidates setup`,
  }
}

// Formats rich markdown for systematic agent response and UI cards
export function formatSetupMarkdown(s: PropTradeSetup): string {
  if (s.direction === "NO_TRADE") {
    return `### ⏸️ [${s.mode.toUpperCase()}] ${s.symbol} · NO TRADE\n- **Bias**: ${s.bias.toUpperCase()} (${s.confluenceScore}/6 confluence)\n- **Reason**: Insufficient confluence or choppy regime (CHOP: ${s.regime.chopIndex}).`
  }

  const icon = s.direction === "LONG" ? "🟢" : "🔴"
  const tps = s.takeProfits.map((t) => `  - **TP${t.level}**: \`$${t.price}\` (${t.pctGain}% · R:R 1:${t.rrr}) — ${t.rationale}`).join("\n")

  return `### ${icon} [${s.mode.toUpperCase()}] ${s.direction} ${s.symbol} · High Probability Setup

- **Confluence**: \`${s.confluenceScore}/6 Factors Aligned\` (${s.alignedFactors.join(", ") || "Structure + Volume"})
- **Market Regime**: ${s.regime.label} (CHOP: ${s.regime.chopIndex})
- **Execution Plan**:
  - **Entry Zone**: \`$${s.entry.zoneLow.toFixed(2)} - $${s.entry.zoneHigh.toFixed(2)}\` (Current: \`$${s.currentPrice}\`)
  - **Stop Loss (SL)**: \`$${s.stopLoss.price}\` (${s.stopLoss.distancePct}% Risk) — *${s.stopLoss.rationale}*
${tps}
  - **Risk / Reward**: **1 : ${s.riskRewardRatio}**
- **Invalidation**: ${s.invalidation}`
}

// Deep deterministic trade setup evaluation for a single symbol
export async function evaluatePropSetup(
  symbol: string,
  mode: "intraday" | "swing" = "intraday",
  config?: BinanceConfig
): Promise<PropTradeSetup> {
  const baseTf = mode === "intraday" ? "15m" : "1h"
  const htfTf = mode === "intraday" ? "1h" : "4h"

  const [baseCandles, htfCandles] = await Promise.all([
    fetchKlines(symbol, baseTf, 150, config),
    fetchKlines(symbol, htfTf, 100, config),
  ])

  if (baseCandles.length < 30) throw new Error(`Insufficient candle history for ${symbol}`)
  const lastPrice = baseCandles[baseCandles.length - 1].close
  const chopIndex = calculateChop(baseCandles)
  const isTrending = chopIndex < 50

  const fvg = detectFVGs(baseCandles)
  const ob = detectOrderBlocks(baseCandles)
  const structure = detectMarketStructure(baseCandles)
  const liquidity = detectLiquidityPools(baseCandles)
  const pd = detectPremiumDiscount(baseCandles)
  const sessions = detectICTSessions(baseCandles)
  const sb = detectSilverBulletWindows(baseCandles)
  const ote = detectICTOTEZone(baseCandles)
  const judas = detectJudasSwings(baseCandles)
  const amd = detectAMDCycles(baseCandles)
  const sd = detectSupplyDemandZones(baseCandles)
  const tl = detectTrendlineLiquidity(baseCandles)
  const cp = detectCandlestickPatterns(baseCandles)
  const htf = buildHtfBias(htfCandles, htfTf)

  const scan = scanSetups({
    lastPrice, fvg, ob, structure, liquidity, pd,
    sessions, sb, ote, judas, amd, sd, tl, cp, htf, symbol,
  })

  const alignedFactors = scan.confluence.filter((c) => c.aligned).map((c) => c.name)
  let plan = scan.direction === "LONG"
    ? buildLongPlan(lastPrice, ob.find((o) => o.type === "BULLISH_OB" && !o.mitigated), liquidity.find((l) => l.type === "SSL" && l.swept), liquidity.find((l) => l.type === "BSL" && !l.swept && l.level > lastPrice))
    : scan.direction === "SHORT"
      ? buildShortPlan(lastPrice, ob.find((o) => o.type === "BEARISH_OB" && !o.mitigated), liquidity.find((l) => l.type === "BSL" && l.swept), liquidity.find((l) => l.type === "SSL" && !l.swept && l.level < lastPrice))
      : buildLongPlan(lastPrice, null, null, null)

  const setup: PropTradeSetup = {
    symbol: symbol.toUpperCase(),
    mode,
    direction: scan.direction,
    bias: scan.bias,
    confluenceScore: scan.alignedCount,
    alignedFactors,
    currentPrice: lastPrice,
    entry: plan.entry,
    stopLoss: plan.stopLoss,
    takeProfits: plan.takeProfits,
    riskRewardRatio: plan.riskRewardRatio,
    regime: { isTrending, adx: 28, chopIndex, label: isTrending ? "Trending Expansion" : "Choppy Consolidation" },
    invalidation: plan.invalidation,
    summaryMarkdown: "",
  }
  setup.summaryMarkdown = formatSetupMarkdown(setup)
  return setup
}

// Scans all watchlist pairs and returns active trade setups
export async function scanPropWatchlist(
  symbols: string[] = DEFAULT_PROP_WATCHLIST,
  mode: "intraday" | "swing" = "intraday",
  config?: BinanceConfig
): Promise<PropTradeSetup[]> {
  const results = await Promise.allSettled(symbols.map((sym) => evaluatePropSetup(sym, mode, config)))
  return results
    .filter((r): r is PromiseFulfilledResult<PropTradeSetup> => r.status === "fulfilled")
    .map((r) => r.value)
}
