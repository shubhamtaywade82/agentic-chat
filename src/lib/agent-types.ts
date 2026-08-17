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
  iteration: number // which ReAct loop iteration (1-based)
  startedAt: number
  finishedAt?: number
  durationMs?: number
}

export interface ThinkingStep extends BaseStep {
  kind: "thinking"
  title: string
  reasoning: string // the chain-of-thought text (supports markdown-ish)
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
  source: string // tool name that produced this
  summary: string
  data?: unknown
}

export interface AnswerStep extends BaseStep {
  kind: "answer"
  content: string // markdown
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
  // for user messages
  content?: string
  // for agent messages
  trace?: TraceStep[]
  query?: string // the user query this agent message responds to
  status?: "running" | "completed" | "error" | "idle"
  startedAt?: number
  finishedAt?: number
  totalTokens?: number
  iterations?: number
  // snapshot of the config used for this turn (so the trace stays accurate
  // even if the user later changes the config)
  modelId?: string
  systemPrompt?: string
  temperature?: number
  maxIterations?: number
}

export interface ToolDefinition {
  name: string
  description: string
  icon: string
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  { name: "web_search", description: "Search the web for real-time information", icon: "search" },
  { name: "calculator", description: "Evaluate mathematical expressions", icon: "calculator" },
  { name: "code_interpreter", description: "Run Python code in a sandbox", icon: "terminal" },
  { name: "file_reader", description: "Read contents of a file", icon: "file-text" },
  { name: "weather_api", description: "Get current weather for a location", icon: "cloud-sun" },
  { name: "knowledge_base", description: "Query the internal knowledge base", icon: "database" },
  { name: "image_gen", description: "Generate an image from a prompt", icon: "image" },
]

export interface ModelOption {
  id: string
  label: string
  contextWindow: number
  costPer1k: number // fictional cost for flavor
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "gpt-reac-4o", label: "GPT-ReAct 4o", contextWindow: 128_000, costPer1k: 5 },
  { id: "gpt-reac-4o-mini", label: "GPT-ReAct 4o mini", contextWindow: 64_000, costPer1k: 1 },
  { id: "claude-react-3.5", label: "Claude ReAct 3.5", contextWindow: 200_000, costPer1k: 8 },
  { id: "llama-react-70b", label: "Llama ReAct 70B", contextWindow: 32_000, costPer1k: 0.5 },
]

export interface AgentConfig {
  modelId: string
  systemPrompt: string
  temperature: number // 0 - 1
  maxIterations: number // cap on ReAct loops
  maxTokens: number // response budget
  enabledTools: Record<string, boolean> // toolName -> enabled
}

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful, methodical ReAct agent.
Decompose the user's request into a plan, then iterate through
Thought → Action → Observation loops until you can produce a
confident final answer. Use tools when they help; reason clearly
about each observation.`

export const DEFAULT_CONFIG: AgentConfig = {
  modelId: "gpt-reac-4o",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.4,
  maxIterations: 6,
  maxTokens: 2048,
  enabledTools: Object.fromEntries(AVAILABLE_TOOLS.map((t) => [t.name, true])),
}
