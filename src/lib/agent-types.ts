// Core types for the agentic ReAct loop visualization

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

export type LlmProvider = "ollama_local" | "ollama_cloud" | "openai" | "anthropic" | "gemini" | "groq" | "custom"

export const DEFAULT_PROVIDER_URLS: Record<LlmProvider, string> = {
  ollama_local: "http://localhost:11434",
  ollama_cloud: "https://api.ollama.com",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com",
  groq: "https://api.groq.com/openai/v1",
  custom: "",
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
}

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: AgentMessage[]
}

export const DEFAULT_SYSTEM_PROMPT = `You are a methodical, autonomous ReAct agent with direct access to live crypto market data (Binance USD-M) and Indian equity/F&O markets (DhanHQ).
Follow the ReAct (Reasoning + Acting) loop:
1. Plan: Decompose the request into logical steps.
2. Thought: Reason about what action is needed.
3. Action: Call tools when helpful to verify live prices, candlestick data, quotes, order book, or open interest.
4. Observation: Inspect tool output carefully.
5. Final Answer: Format your answer cleanly using rich GitHub-flavored Markdown (fenced code blocks with language tags, tables, bullet points, headers, bold/italic formatting).`

export const DEFAULT_CONFIG: AgentConfig = {
  modelId: "llama3.2:3b",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.3,
  maxIterations: 6,
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
}
