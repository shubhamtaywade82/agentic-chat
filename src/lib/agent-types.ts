// Core types for chat sessions and the run trace the UI renders

export type StepStatus = "pending" | "running" | "completed" | "error"

export type StepKind =
  | "thinking" // Internal reasoning / thought
  | "tool_call" // Action: calling a tool
  | "observation" // Result returned by a tool
  | "answer" // Final answer to the user
  | "plan" // High-level plan / decomposition
  | "interaction" // The run is paused waiting for the user (approval / clarification)

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
  // Set when Nexum labels the answer as OpenUI (run.completed output.format).
  // The client only attempts OpenUI Lang parsing when this is true: otherwise
  // a plain Markdown answer that incidentally resembles the DSL (e.g. code
  // with `Type.new(...)` calls) could get misrouted into the OpenUI renderer.
  openuiActive?: boolean
}

export interface InteractionStep extends BaseStep {
  kind: "interaction"
  interactionId: string
  interaction: "approval" | "clarification"
  // approval
  title?: string
  summary?: string
  // clarification
  question?: string
  options?: { id: string; label: string; description?: string }[]
  /** Set once the interaction is resolved (by the user, a timeout, or a cancelled run). */
  resolution?: { approved?: boolean; selectedId?: string }
  /** Why the last attempt to answer failed; the step stays pending so the user can retry. */
  error?: string
}

export type TraceStep =
  | ThinkingStep
  | PlanStep
  | ToolCallStep
  | ObservationStep
  | AnswerStep
  | InteractionStep

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
}

/**
 * Client-side preferences. Everything about how the agent runs (model, tools,
 * credentials, MCP, memory) belongs to the Nexum server, not the browser.
 */
export interface AgentConfig {
  /** Ask Nexum for generative-UI (OpenUI) answers where it fits; see docs/openui-integration.md. */
  openuiEnabled: boolean
}

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: AgentMessage[]
  /** The Nexum session this chat is bound to, created on the first turn and
   * reused for every later turn so the conversation stays continuous. */
  nexumSessionId?: string
}

export const DEFAULT_CONFIG: AgentConfig = {
  openuiEnabled: false,
}
