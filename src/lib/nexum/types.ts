export type OutputFormat = "markdown" | "openui" | "json" | "text";

export interface NexumRunOutput {
  format: OutputFormat;
  content: string;
  schemaVersion?: string;
}

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export interface NexumSession {
  id: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

export interface CreateSessionParams {
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface NexumRun {
  id: string;
  sessionId: string;
  goal: string;
  status: RunStatus;
  output?: NexumRunOutput;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

export interface CreateRunParams {
  goal: string;
  strategy?: string;
  outputFormat?: OutputFormat;
  openuiSpec?: string;
  /** This client shows approvals/clarifications to the user; otherwise Nexum denies/skips them. */
  interactive?: boolean;
  timeoutMs?: number;
}

export interface ToolResult {
  ok: boolean;
  data: Record<string, unknown>;
  error?: { code: string; message: string };
}

export interface InteractionResolution {
  approved?: boolean;
  selectedId?: string;
}

export interface RunEventEnvelope {
  id?: string;
  seq: number;
  runId: string;
  type: string;
  ts: number;
  payload: Record<string, unknown> & { type: string };
}

export interface NexumToolInfo {
  id: string;
  description: string;
  pack: string;
  risk: "read" | "low" | "medium" | "high" | "critical";
  /** A rendered UI may call this tool directly; otherwise it needs an agent run. */
  uiInvocable: boolean;
}

export interface NexumSkillInfo {
  id: string;
  name: string;
  description: string;
  tags: string[];
  scope: string;
}

export interface NexumModelInfo {
  name: string;
  capabilities: string[];
}

export interface NexumMcpServerInfo {
  name: string;
  trust: "trusted" | "ask" | "untrusted";
  /** `denied` means the server's trust policy refused it (for example `ask` with no recorded approval). */
  status: "connected" | "failed" | "denied";
  tools: number;
}

/** What the connected Nexum server can do; the client reads this instead of assuming. */
export interface NexumCapabilities {
  protocolVersion: string;
  serverVersion?: string;
  agents: string[];
  strategies: string[];
  outputFormats: OutputFormat[];
  tools: NexumToolInfo[];
  skills: NexumSkillInfo[];
  models: NexumModelInfo[];
  mcp: NexumMcpServerInfo[];
}

export interface NexumClientOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
}
