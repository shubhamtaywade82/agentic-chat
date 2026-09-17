// Core types for the agentic ReAct loop visualization

import { buildDefaultMcpServers } from "@/lib/mcp/registry"
import type { McpServerConfig } from "@/lib/mcp/types"

// Re-export McpServerConfig so consumers of agent-types don't need a second
// import path. This is the canonical public type surface for the agent
// config + MCP integration.
export type { McpServerConfig } from "@/lib/mcp/types"

export type StepStatus = "pending" | "running" | "completed" | "error"

export type StepKind =
  | "thinking" // Internal reasoning / thought
  | "tool_call" // Action: calling a tool
  | "observation" // Result returned by a tool
  | "answer" // Final answer to the user
  | "plan" // High-level plan / decomposition

export interface BaseStep {
  id: string
  kind: StepKind
  status: StepStatus
  iteration: number
  startedAt: number
  finishedAt?: number
  durationMs?: number
}

export interface ThinkingStep extends BaseStep {
  kind: "thinking"
  title: string
  reasoning: string
  tokensIn?: number
  tokensOut?: number
}

export interface PlanStep extends BaseStep {
  kind: "plan"
  goal: string
  steps: { id: string; text: string; done: boolean }[]
}

export interface ToolCallStep extends BaseStep {
  kind: "tool_call"
  toolName: string
  toolIcon?: string
  description: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
}

export interface ObservationStep extends BaseStep {
  kind: "observation"
  source: string
  summary: string
  data?: unknown
}

export interface AnswerStep extends BaseStep {
  kind: "answer"
  content: string
}

export type TraceStep =
  | ThinkingStep
  | PlanStep
  | ToolCallStep
  | ObservationStep
  | AnswerStep

export interface AgentMessage {
  id: string
  role: "user" | "agent"
  content?: string
  trace?: TraceStep[]
  query?: string
  status?: "running" | "completed" | "error" | "idle"
  startedAt?: number
  finishedAt?: number
  totalTokens?: number
  iterations?: number
  modelId?: string
  systemPrompt?: string
  temperature?: number
  maxIterations?: number
  provider?: LlmProvider
}

export interface ToolDefinition {
  name: string
  description: string
  icon: string
  category?: "general" | "crypto" | "indian_markets"
  isCustom?: boolean
}

export interface CustomTool {
  id: string
  name: string
  description: string
  icon?: string
  mode: "javascript" | "fetch" | "static"
  code: string
  parameters?: string
  enabled: boolean
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  // General Playground Tools
  { name: "web_search", description: "Search the web & Wikipedia for real-time information", icon: "search", category: "general" },
  { name: "calculator", description: "Evaluate mathematical expressions", icon: "calculator", category: "general" },
  { name: "code_interpreter", description: "Run sandbox JavaScript code", icon: "terminal", category: "general" },
  { name: "weather_api", description: "Get real-time weather & forecast for any location", icon: "cloud-sun", category: "general" },

  // Binance Crypto Market Data (Public & Realtime)
  { name: "binance_price", description: "Get real-time crypto prices (e.g. BTCUSDT, ETHUSDT) from Binance USD-M", icon: "trending-up", category: "crypto" },
  { name: "binance_24hr_ticker", description: "Get 24hr volume, price change %, high & low from Binance", icon: "activity", category: "crypto" },
  { name: "binance_klines", description: "Get candlestick OHLCV data for crypto pairs", icon: "bar-chart-3", category: "crypto" },
  { name: "binance_order_book", description: "Get order book bids & asks depth for a symbol", icon: "layers", category: "crypto" },
  { name: "binance_funding_rate", description: "Get current & historical funding rate statistics", icon: "percent", category: "crypto" },
  { name: "binance_open_interest", description: "Get total open interest and historical statistics", icon: "pie-chart", category: "crypto" },
  { name: "binance_long_short_ratio", description: "Get global & top trader long/short position ratios", icon: "scale", category: "crypto" },

  // Systematic Prop Trading & Algo Event Engine
  { name: "prop_scan_setups", description: "Scan crypto futures watchlist (SOL, ETH, XRP, BTC) for systematic SMC/ICT trade setups", icon: "radar", category: "crypto" },
  { name: "prop_evaluate_pair", description: "Deep quantitative evaluation of a pair with exact Entry, SL, TP1/2/3, RRR and invalidation", icon: "crosshair", category: "crypto" },
  { name: "prop_risk_calculator", description: "Calculate exact position size, margin, and risk-to-reward ratio for a trade setup", icon: "shield-check", category: "crypto" },

  // DhanHQ Indian Equity & F&O Markets
  { name: "dhan_ltp", description: "Get real-time Last Traded Price for NSE, BSE, MCX symbols", icon: "indian-rupee", category: "indian_markets" },
  { name: "dhan_quote", description: "Get full market quote with OHLC and market depth", icon: "table", category: "indian_markets" },
  { name: "dhan_historical", description: "Get historical candlestick chart data for Indian equities & F&O", icon: "candlestick-chart", category: "indian_markets" },
  { name: "dhan_holdings", description: "Get portfolio stock holdings from Dhan account", icon: "briefcase", category: "indian_markets" },
  { name: "dhan_positions", description: "Get open intraday & carry-forward positions", icon: "list-ordered", category: "indian_markets" },
  { name: "dhan_funds", description: "Get available fund limits, cash and collateral margin", icon: "wallet", category: "indian_markets" },
  { name: "dhan_option_chain", description: "Get full option chain with strikes, IV, and Greeks", icon: "network", category: "indian_markets" },
  { name: "dhan_option_skill", description: "Execute option strategies (Iron Condor, Straddle, Spreads)", icon: "target", category: "indian_markets" },
  { name: "dhan_market_summary", description: "Summarize technicals, PCR, OI walls, max pain for a symbol", icon: "file-spreadsheet", category: "indian_markets" },
]

// OpenUI integration (Pattern A): the OpenUI Gateway
// (https://api.thesys.dev/v1/embed) is an OpenAI-compatible inference
// endpoint that auto-validates OpenUI Lang output mid-stream. Because
// `callLlm` in src/app/api/agent/route.ts already speaks OpenAI Chat
// Completions, no routing changes are needed — we just register the
// provider and its base URL here. See docs/openui-integration.md §3.A.
export type LlmProvider =
  | "ollama_local"
  | "ollama_cloud"
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "custom"
  | "openui_gateway"

export const DEFAULT_PROVIDER_URLS: Record<LlmProvider, string> = {
  ollama_local: "http://localhost:11434",
  ollama_cloud: "https://ollama.com",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com",
  groq: "https://api.groq.com/openai/v1",
  custom: "",
  openui_gateway: "https://api.thesys.dev/v1/embed",
}

export interface ProviderApiKey {
  id: string
  label: string
  key: string
  provider: LlmProvider
  createdAt: number
}

export interface ModelOption {
  id: string
  label: string
  contextWindow: number
  costPer1k: number
  provider: LlmProvider
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "llama3.2:3b", label: "Llama 3.2 3B (Ollama)", contextWindow: 128_000, costPer1k: 0, provider: "ollama_local" },
  { id: "qwen3.5:4b", label: "Qwen 3.5 4B (Ollama)", contextWindow: 128_000, costPer1k: 0, provider: "ollama_local" },
  { id: "gpt-4o", label: "GPT-4o (OpenAI)", contextWindow: 128_000, costPer1k: 5, provider: "openai" },
  { id: "gpt-4o-mini", label: "GPT-4o mini (OpenAI)", contextWindow: 128_000, costPer1k: 0.15, provider: "openai" },
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (Anthropic)", contextWindow: 200_000, costPer1k: 3, provider: "anthropic" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Google)", contextWindow: 1_000_000, costPer1k: 0.1, provider: "gemini" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", contextWindow: 128_000, costPer1k: 0.5, provider: "groq" },
  // OpenUI Gateway default. The Gateway routes to many underlying providers
  // (openai/*, anthropic/*, etc.); this entry just gives the config dialog
  // something to show before the user fetches the live model list.
  { id: "openai/gpt-5", label: "GPT-5 via OpenUI Gateway", contextWindow: 128_000, costPer1k: 5, provider: "openui_gateway" },
]

export type DhanAuthMode = "direct" | "endpoint"

export interface DhanConfig {
  authMode: DhanAuthMode
  token: string
  clientId: string
  endpointBaseUrl: string
  bearerToken: string
}

export interface BinanceConfig {
  apiKey: string
  apiSecret: string
  testnet: boolean
}

export type MemoryCategory = "preference" | "learned_pattern" | "trading_fact" | "user_instruction"

export interface AgentMemoryItem {
  id: string
  category: MemoryCategory
  title: string
  content: string
  source: "user" | "agent_learning" | "session_distill"
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface AgentConfig {
  modelId: string
  systemPrompt: string
  temperature: number
  maxIterations: number
  maxTokens: number
  enabledTools: Record<string, boolean>
  provider: LlmProvider
  apiKey: string
  apiKeys: ProviderApiKey[]
  apiBaseUrl: string
  customTools: CustomTool[]
  memories: AgentMemoryItem[]
  dhan: DhanConfig
  binance: BinanceConfig
  // MCP (Model Context Protocol) servers — extend the agent's tool surface
  // dynamically. Each enabled server's tools are auto-discovered and injected
  // into the system prompt. See src/lib/mcp/* for the client manager.
  mcpServers: McpServerConfig[]
  // OpenUI generative-UI rendering (Pattern B). When true, the system
  // prompt is augmented with the OpenUI component spec (cloud:false,
  // self-hosted — works with ANY provider, no THESYS_API_KEY required),
  // and the Final Answer is rendered via <Renderer> instead of Markdown
  // when `looksLikeOpenUILang(content)` returns true. See
  // docs/openui-integration.md §3.B.
  openuiEnabled: boolean
}

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: AgentMessage[]
}

export const DEFAULT_SYSTEM_PROMPT = `You are an advanced, versatile ReAct agent. You can assist with general knowledge, software engineering, mathematics, and problem solving, as well as execute real-time tools across multiple domains.

INTENT DETECTION & WORKFLOW:
1. First identify user intent:
   - General Knowledge & Programming (e.g. explanations, code, architecture, algorithms): Answer directly using your knowledge. Do NOT force tool calls or trading context.
   - General Utilities: Use calculator for math, code_interpreter for executing JavaScript, web_search for web facts, and weather_api for weather.
   - Crypto Markets (e.g. BTC, SOL, ETH): Use binance_* or prop_* tools. Never call dhan_* tools for crypto.
   - Indian Markets (e.g. NIFTY, BANKNIFTY, RELIANCE): Use dhan_* tools. Never call binance_* tools for Indian equities.

2. Follow the ReAct (Reasoning + Acting) loop:
   - Plan: Decompose the request into logical steps.
   - Thought: Reason about user intent and whether an external tool is required.
   - Action: Call the appropriate tool only if external data or computation is needed. If no tool is needed, proceed directly to Final Answer.
   - Observation: Inspect tool output carefully.
   - Final Answer: Present your response in clean, rich GitHub-flavored Markdown.`

export const DEFAULT_CONFIG: AgentConfig = {
  modelId: "llama3.2:3b",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.3,
  maxIterations: 10,
  maxTokens: 2048,
  enabledTools: Object.fromEntries(AVAILABLE_TOOLS.map((t) => [t.name, true])),
  provider: "ollama_local",
  apiKey: "",
  apiKeys: [],
  apiBaseUrl: "http://localhost:11434",
  customTools: [],
  memories: [
    {
      id: "mem_crypto_default",
      category: "trading_fact",
      title: "Binance USD-M Symbol Format",
      content: "Binance futures trading pairs must be in uppercase without slashes (e.g. BTCUSDT, SOLUSDT, ETHUSDT).",
      source: "agent_learning",
      enabled: true,
      createdAt: 1786950000000,
      updatedAt: 1786950000000,
    },
    {
      id: "mem_dhan_default",
      category: "trading_fact",
      title: "DhanHQ Indian Market Security IDs",
      content: "NIFTY 50 index is securityId 13 under segment IDX_I. BANKNIFTY is securityId 25 under IDX_I. Equities belong to NSE_EQ or BSE_EQ.",
      source: "agent_learning",
      enabled: true,
      createdAt: 1786950000000,
      updatedAt: 1786950000000,
    },
    {
      id: "mem_format_pref",
      category: "preference",
      title: "Tabular Market Data Presentation",
      content: "Format price quotes, funding rates, open interest, and technical levels in clean markdown tables with clear column headers.",
      source: "user",
      enabled: true,
      createdAt: 1786950000000,
      updatedAt: 1786950000000,
    },
  ],
  dhan: {
    authMode: "endpoint",
    token: "",
    clientId: "",
    endpointBaseUrl: "https://algo-trading-api.onrender.com",
    bearerToken: "",
  },
  binance: {
    apiKey: "",
    apiSecret: "",
    testnet: false,
  },
  mcpServers: buildDefaultMcpServers(),
  openuiEnabled: false,
}
