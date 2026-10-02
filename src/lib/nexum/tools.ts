import type { ToolResult } from "./types";
import type { RequestExecutor } from "./sessions";

export class NexumToolsClient {
  constructor(private readonly executor: RequestExecutor) {}

  /** Runs a read-only tool in a session; Nexum refuses (403) anything that changes state. */
  async invoke(
    sessionId: string,
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const encodedSession = encodeURIComponent(sessionId);
    const encodedTool = encodeURIComponent(name);
    return this.executor.request<ToolResult>(`/sessions/${encodedSession}/tools/${encodedTool}`, {
      method: "POST",
      body: JSON.stringify({ args }),
      signal,
    });
  }
}
