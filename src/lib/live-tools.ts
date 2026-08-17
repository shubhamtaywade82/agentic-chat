import type { BinanceConfig, CustomTool, DhanConfig } from "./agent-types"
import * as DhanPkg from "@shubhamtaywade82/dhanhq-ts"
import * as BinancePkg from "binance-client-ts"

const DhanClient = (DhanPkg as { DhanClient?: typeof DhanPkg.DhanClient; default?: { DhanClient?: typeof DhanPkg.DhanClient } }).DhanClient || (DhanPkg as { default?: { DhanClient?: typeof DhanPkg.DhanClient } }).default?.DhanClient || DhanPkg.DhanClient
const AgentToolRegistry = (DhanPkg as { AgentToolRegistry?: typeof DhanPkg.AgentToolRegistry; default?: { AgentToolRegistry?: typeof DhanPkg.AgentToolRegistry } }).AgentToolRegistry || (DhanPkg as { default?: { AgentToolRegistry?: typeof DhanPkg.AgentToolRegistry } }).default?.AgentToolRegistry || DhanPkg.AgentToolRegistry
const BinanceClient = (BinancePkg as { BinanceClient?: typeof BinancePkg.BinanceClient; default?: { BinanceClient?: typeof BinancePkg.BinanceClient } }).BinanceClient || (BinancePkg as { default?: { BinanceClient?: typeof BinancePkg.BinanceClient } }).default?.BinanceClient || BinancePkg.BinanceClient

// Resolves DhanClient using Direct or Endpoint Auth
export async function resolveDhanClient(config?: DhanConfig): Promise<InstanceType<typeof DhanClient>> {
  if (config?.authMode === "endpoint") {
    const endpointBaseUrl = config.endpointBaseUrl || "https://algo-trading-api.onrender.com"
    const bearerToken = config.bearerToken || process.env.DHAN_TOKEN_ACCESS_TOKEN || ""
    return await DhanClient.fromTokenEndpoint({ endpointBaseUrl, bearerToken })
  }
  const token = config?.token || process.env.DHAN_TOKEN || ""
  const clientId = config?.clientId || process.env.DHAN_CLIENT_ID || ""
  return new DhanClient({ token, clientId })
}

// Resolves BinanceClient for public or private APIs
export function resolveBinanceClient(config?: BinanceConfig): InstanceType<typeof BinanceClient> {
  return new BinanceClient({
    apiKey: config?.apiKey || undefined,
    apiSecret: config?.apiSecret || undefined,
    testnet: Boolean(config?.testnet),
  })
}

// Unwraps parsed arguments if wrapped in string or nested input field
export function normalizeArgs(args: Record<string, unknown> | string): Record<string, unknown> {
  let parsed: Record<string, unknown> = {}
  if (typeof args === "string") {
    try {
      const p = JSON.parse(args)
      parsed = typeof p === "object" && p !== null ? p : { input: args }
    } catch {
      parsed = { input: args }
    }
  } else if (typeof args === "object" && args !== null) {
    parsed = { ...args }
  }

  if (typeof parsed.input === "string" && (parsed.input.startsWith("{") || parsed.input.startsWith("["))) {
    try {
      const nested = JSON.parse(parsed.input)
      if (typeof nested === "object" && nested !== null) {
        parsed = { ...parsed, ...nested }
      }
    } catch {
      // keep
    }
  }

  return parsed
}

// Returns structured instructions explaining available tools to the LLM
export function getToolSystemPrompt(enabledTools: Record<string, boolean>, customTools: CustomTool[] = []): string {
  const tools: string[] = []

  // General tools
  if (enabledTools.calculator !== false) tools.push(`- calculator: {"expression": "string"} // Evaluate math expressions (e.g. {"expression": "45 * 18 + 120"})`)
  if (enabledTools.weather_api !== false) tools.push(`- weather_api: {"location": "string"} // Get real-time weather (e.g. {"location": "Tokyo"})`)
  if (enabledTools.web_search !== false) tools.push(`- web_search: {"query": "string"} // Search Wikipedia and web for live facts`)
  if (enabledTools.code_interpreter !== false) tools.push(`- code_interpreter: {"code": "string"} // Execute sandbox JavaScript code`)

  // Binance tools
  if (enabledTools.binance_price !== false) tools.push(`- binance_price: {"symbol": "string"} // Real-time crypto price (e.g. {"symbol": "BTCUSDT"})`)
  if (enabledTools.binance_24hr_ticker !== false) tools.push(`- binance_24hr_ticker: {"symbol": "string"} // 24hr stats, % change, volume, high, low`)
  if (enabledTools.binance_klines !== false) tools.push(`- binance_klines: {"symbol": "string", "interval": "1h"|"15m"|"1d", "limit": 10} // Candlestick OHLCV data`)
  if (enabledTools.binance_order_book !== false) tools.push(`- binance_order_book: {"symbol": "string", "limit": "20"} // Order book depth bids & asks`)
  if (enabledTools.binance_funding_rate !== false) tools.push(`- binance_funding_rate: {"symbol": "string"} // Current and historical funding rates`)
  if (enabledTools.binance_open_interest !== false) tools.push(`- binance_open_interest: {"symbol": "string"} // Real-time total open interest`)
  if (enabledTools.binance_long_short_ratio !== false) tools.push(`- binance_long_short_ratio: {"symbol": "string", "period": "1h"} // Top trader & global long/short ratio`)

  // DhanHQ tools
  if (enabledTools.dhan_ltp !== false) tools.push(`- dhan_ltp: {"securityId": "1333", "exchangeSegment": "NSE_EQ"} // Last Traded Price for Indian stocks`)
  if (enabledTools.dhan_quote !== false) tools.push(`- dhan_quote: {"securityId": "1333", "exchangeSegment": "NSE_EQ"} // Full quote with OHLC and depth`)
  if (enabledTools.dhan_holdings !== false) tools.push(`- dhan_holdings: {} // Fetch stock holdings from Dhan account`)
  if (enabledTools.dhan_positions !== false) tools.push(`- dhan_positions: {} // Fetch open trading positions`)
  if (enabledTools.dhan_funds !== false) tools.push(`- dhan_funds: {} // Fetch available cash limits and margin`)
  if (enabledTools.dhan_option_chain !== false) tools.push(`- dhan_option_chain: {"underlyingScrip": 13, "underlyingSegment": "IDX_I", "expiry": "YYYY-MM-DD"} // Option chain with Greeks`)
  if (enabledTools.dhan_market_summary !== false) tools.push(`- dhan_market_summary: {"underlyingSymbol": "NIFTY"} // Summarize technicals, PCR, and OI walls`)

  for (const c of customTools) {
    if (c.enabled) tools.push(`- ${c.name}: ${c.parameters || "{}"} // ${c.description}`)
  }

  return `AVAILABLE TOOLS:
${tools.join("\n")}

REACT INSTRUCTIONS:
Always think step-by-step using this exact format:
Plan:
- Step 1: Description
- Step 2: Description

Thought: [Explain your reasoning]
Action: tool_name
Action Input: {"param": "value"}

(When you receive the Observation from the system):
Thought: [Evaluate the observation result]
Final Answer: [Your complete response formatted in rich GitHub-flavored Markdown. Use fenced code blocks (\`\`\`language) for code/JSON/HTML, markdown tables for tabular data, and lists/headers.]

EXAMPLE:
Plan:
- Step 1: Fetch live price
Thought: I will fetch the live price using binance_price.
Action: binance_price
Action Input: {"symbol": "SOLUSDT"}`
}

// Math calculation helper
export function executeCalculator(expression: string): { expression: string; result: number } {
  const sanitized = expression
    .replace(/×/g, "*").replace(/÷/g, "/").replace(/\^/g, "**")
    .replace(/sqrt\(/g, "Math.sqrt(").replace(/sin\(/g, "Math.sin(").replace(/cos\(/g, "Math.cos(")
    .replace(/tan\(/g, "Math.tan(").replace(/abs\(/g, "Math.abs(")
    .replace(/log\(/g, "Math.log10(").replace(/ln\(/g, "Math.log(")
    .replace(/pi/gi, "Math.PI").replace(/e/gi, "Math.E")

  if (/[^0-9+\-*/().,%\sMathPIE*]/.test(sanitized)) throw new Error("Invalid characters in math expression")
  const result = Number(new Function(`"use strict"; return (${sanitized})`)())
  if (isNaN(result) || !isFinite(result)) throw new Error("Math expression resulted in NaN or Infinity")
  return { expression, result: Number(result.toFixed(6)) }
}

// Weather lookup helper
export async function executeWeather(location: string) {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`)
  const geoData = await geoRes.json()
  if (!geoData.results || geoData.results.length === 0) return { location, error: `Location "${location}" not found`, temperature_c: 20 }
  const { latitude, longitude, name, country } = geoData.results[0]
  const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`)
  const data = await weatherRes.json()
  return { location: `${name}, ${country}`, temperature_c: Math.round(data.current?.temperature_2m ?? 0), humidity: data.current?.relative_humidity_2m ?? 0 }
}

// Web search helper
export async function executeWebSearch(query: string) {
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`)
    const data = await res.json()
    const searchResults = (data?.query?.search ?? []).slice(0, 3).map((item: { title: string; snippet: string }) => ({
      title: item.title,
      snippet: item.snippet.replace(/<[^>]+>/g, ""),
    }))
    return { query, results: searchResults, total: searchResults.length }
  } catch {
    return { query, results: [{ title: query, snippet: `Live reference for ${query}` }], total: 1 }
  }
}

// Code interpreter helper
export function executeCodeInterpreter(code: string) {
  const logs: string[] = []
  const customConsole = { log: (...args: unknown[]) => logs.push(args.map((a) => String(a)).join(" ")) }
  try {
    const fn = new Function("console", `"use strict"; ${code}`)
    const returned = fn(customConsole)
    return { exit_code: 0, stdout: logs.join("\n") || (returned !== undefined ? String(returned) : "(no output)") }
  } catch (err: unknown) {
    return { exit_code: 1, stderr: err instanceof Error ? err.message : String(err) }
  }
}

// Custom tool executor
export async function executeCustomTool(tool: CustomTool, args: Record<string, unknown>) {
  if (tool.mode === "static") {
    try { return JSON.parse(tool.code) } catch { return { result: tool.code } }
  }
  if (tool.mode === "fetch") {
    const url = tool.code.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(String(args[k] ?? "")))
    const res = await fetch(url)
    return await res.json()
  }
  const fn = new Function("args", `"use strict"; ${tool.code}`)
  return await fn(args)
}

// Unified dispatcher for live tool execution
export async function executeLiveTool(
  toolName: string,
  args: Record<string, unknown> | string,
  customTools: CustomTool[] = [],
  dhanConfig?: DhanConfig,
  binanceConfig?: BinanceConfig
): Promise<{ summary: string; data: unknown; error?: string }> {
  try {
    const parsedArgs: Record<string, unknown> = normalizeArgs(args)
    const getStr = (key: string, fallback = "") => String(parsedArgs[key] ?? parsedArgs.symbol ?? parsedArgs.input ?? fallback)
    const norm = toolName.toLowerCase().replace(/[^a-z0-9_]/g, "")

    // Custom Tools
    const custom = customTools.find((t) => t.name === toolName)
    if (custom) {
      const data = await executeCustomTool(custom, parsedArgs)
      return { summary: `Executed ${toolName}`, data }
    }

    // General Tools
    if (norm === "calculator") {
      const expr = getStr("expression", "0")
      const data = executeCalculator(expr)
      return { summary: `Calculated ${expr} = ${data.result}`, data }
    }
    if (norm === "weather_api" || norm === "weather") {
      const loc = getStr("location", "Tokyo")
      const data = await executeWeather(loc)
      return { summary: `Weather for ${data.location}`, data }
    }
    if (norm === "web_search" || norm === "search") {
      const q = getStr("query", "")
      const data = await executeWebSearch(q)
      return { summary: `${data.total} web results for "${q}"`, data }
    }
    if (norm === "code_interpreter") {
      const data = executeCodeInterpreter(getStr("code", ""))
      return { summary: "Code executed", data }
    }

    // Binance Tools (Public Market Data)
    if (norm.startsWith("binance_") || norm.startsWith("futures_")) {
      const binance = resolveBinanceClient(binanceConfig)
      const symbol = getStr("symbol", "BTCUSDT").toUpperCase()

      if (norm.includes("price")) {
        const data = await binance.futures.market.tickerPrice(symbol)
        return { summary: `${symbol} Price: $${data.price}`, data }
      }
      if (norm.includes("24hr") || norm.includes("ticker")) {
        const data = await binance.futures.market.ticker24hr(symbol)
        return { summary: `${symbol} 24h: ${data.priceChangePercent}% ($${data.lastPrice})`, data }
      }
      if (norm.includes("klines")) {
        const interval = (parsedArgs.interval as "1h" | "15m" | "1d") || "1h"
        const limit = Number(parsedArgs.limit || 10)
        const data = await binance.futures.market.klines(symbol, interval, { limit })
        return { summary: `Retrieved ${data.length} klines for ${symbol} (${interval})`, data }
      }
      if (norm.includes("order_book") || norm.includes("depth")) {
        const limit = Number(parsedArgs.limit || 10)
        const data = await binance.futures.market.depth(symbol, limit)
        return { summary: `Order book for ${symbol} (${data.bids.length} bids / ${data.asks.length} asks)`, data }
      }
      if (norm.includes("funding")) {
        const data = await binance.futures.data.fundingRateHistory(symbol, { limit: 5 })
        return { summary: `Funding rates for ${symbol}`, data }
      }
      if (norm.includes("open_interest")) {
        const data = await binance.futures.data.openInterest(symbol)
        return { summary: `Open interest for ${symbol}: ${data.openInterest}`, data }
      }
      if (norm.includes("ratio")) {
        const period = (parsedArgs.period as "5m" | "15m" | "1h" | "4h" | "1d") || "1h"
        const data = await binance.futures.data.globalLongShortAccountRatio(symbol, period, 5)
        return { summary: `Long/short ratio for ${symbol}`, data }
      }
    }

    // DhanHQ Indian Markets Tools
    if (norm.startsWith("dhan_")) {
      const dhan = await resolveDhanClient(dhanConfig)
      const registry = new AgentToolRegistry({ client: dhan })

      if (norm === "dhan_funds") {
        const data = await dhan.funds.getLimit()
        return { summary: `Dhan Funds available: ₹${data.availabelBalance ?? data.sodLimit ?? "Active"}`, data }
      }
      if (norm === "dhan_holdings") {
        const data = await dhan.positions.listHoldings()
        return { summary: `Holdings: ${Array.isArray(data) ? data.length : 0} securities`, data }
      }
      if (norm === "dhan_positions") {
        const data = await dhan.positions.list()
        return { summary: `Positions: ${Array.isArray(data) ? data.length : 0} open positions`, data }
      }

      // Special normalization for NIFTY / Index lookups and instruments map
      if (norm === "dhan_ltp" || norm === "dhan_quote" || norm === "dhan_ohlc") {
        if (!parsedArgs.instruments) {
          const rawSec = String(parsedArgs.securityId || parsedArgs.symbol || parsedArgs.underlyingSymbol || "13")
          const isIndex = rawSec.toUpperCase() === "NIFTY" || rawSec.toUpperCase() === "BANKNIFTY" || rawSec === "13" || rawSec === "25"
          const seg = String(parsedArgs.exchangeSegment || (isIndex ? "IDX_I" : "NSE_EQ"))
          const secId = rawSec.toUpperCase() === "NIFTY" ? 13 : (rawSec.toUpperCase() === "BANKNIFTY" ? 25 : (!isNaN(Number(rawSec)) ? Number(rawSec) : rawSec))
          parsedArgs.instruments = { [seg]: [secId] }
        }
      }

      const resolvedName = (norm === "dhan_market_summary" || norm === "dhan_marketsummary")
        ? "dhan_skill_market_data_summarizer"
        : (norm === "dhan_historical" ? "dhan_historical_data" : (norm === "dhan_intraday" ? "dhan_intraday_data" : norm))

      if (resolvedName === "dhan_skill_market_data_summarizer") {
        parsedArgs.underlyingSymbol = String(parsedArgs.underlyingSymbol || parsedArgs.symbol || parsedArgs.securityId || "NIFTY").toUpperCase()
        if (parsedArgs.underlyingSymbol === "13") parsedArgs.underlyingSymbol = "NIFTY"
        if (parsedArgs.underlyingSymbol === "25") parsedArgs.underlyingSymbol = "BANKNIFTY"
      }

      const toolDef = registry.find(resolvedName) || registry.find(toolName) || registry.find(norm)
      if (toolDef) {
        const result = await registry.execute(toolDef.name, parsedArgs)
        return { summary: `Dhan ${toolDef.name} executed`, data: result }
      }
    }

    return { summary: `Executed ${toolName}`, data: { status: "ok", args: parsedArgs } }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { summary: `Error executing ${toolName}`, data: { error: msg }, error: msg }
  }
}
