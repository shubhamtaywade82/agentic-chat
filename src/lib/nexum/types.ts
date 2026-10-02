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
  timeoutMs?: number;
}

export interface ToolResult {
  ok: boolean;
  data: Record<string, unknown>;
  error?: { code: string; message: string };
}

export interface InteractionResolution {
  approved?: boolean;
  response?: string;
  data?: Record<string, unknown>;
}

export interface RunEventEnvelope {
  id?: string;
  seq: number;
  runId: string;
  type: string;
  ts: number;
  payload: Record<string, unknown> & { type: string };
}

export interface NexumCapabilities {
  name: string;
  version: string;
  protocolVersion: string;
  agents: string[];
  outputFormats?: OutputFormat[];
  tools?: string[];
}

export interface NexumClientOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
}
