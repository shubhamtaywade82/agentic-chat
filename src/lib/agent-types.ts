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
  { name: "web_search", description: "Search the web for real-time information", icon: "search" },
  { name: "calculator", description: "Evaluate mathematical expressions", icon: "calculator" },
  { name: "code_interpreter", description: "Run Python or JavaScript code", icon: "terminal" },
  { name: "file_reader", description: "Read contents of a file", icon: "file-text" },
  { name: "weather_api", description: "Get current weather for a location", icon: "cloud-sun" },
  { name: "knowledge_base", description: "Query the internal knowledge base", icon: "database" },
  { name: "image_gen", description: "Generate an image from a prompt", icon: "image" },
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

export interface AgentConfig {
  modelId: string
  systemPrompt: string
  temperature: number
  maxIterations: number
  maxTokens: number
  enabledTools: Record<string, boolean>
  provider: LlmProvider
  apiKey: string
  apiBaseUrl: string
  customTools: CustomTool[]
}

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: AgentMessage[]
}

export const DEFAULT_SYSTEM_PROMPT = `You are a methodical, autonomous ReAct agent.
Follow the ReAct (Reasoning + Acting) loop:
1. Plan: Decompose the request into steps.
2. Thought: Reason about what action is needed.
3. Action: Call tools when helpful to verify facts or execute calculations.
4. Observation: Inspect tool output carefully.
5. Final Answer: Provide a concise, helpful response.`

export const DEFAULT_CONFIG: AgentConfig = {
  modelId: "llama3.2:3b",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.4,
  maxIterations: 6,
  maxTokens: 2048,
  enabledTools: Object.fromEntries(AVAILABLE_TOOLS.map((t) => [t.name, true])),
  provider: "ollama_local",
  apiKey: "",
  apiBaseUrl: "http://localhost:11434",
  customTools: [],
}
