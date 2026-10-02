import type { NexumRun, CreateRunParams } from "./types";
import type { RequestExecutor } from "./sessions";

export class NexumRunsClient {
  constructor(private readonly executor: RequestExecutor) {}

  async create(
    sessionId: string,
    params: CreateRunParams | string,
    signal?: AbortSignal,
  ): Promise<NexumRun> {
    const body = typeof params === "string" ? { goal: params } : params;
    const encoded = encodeURIComponent(sessionId);
    const res = await this.executor.request<{ run?: NexumRun } & NexumRun>(
      `/sessions/${encoded}/runs`,
      {
        method: "POST",
        body: JSON.stringify(body),
        signal,
      },
    );
    return res.run ?? res;
  }

  async get(runId: string, signal?: AbortSignal): Promise<NexumRun> {
    const encoded = encodeURIComponent(runId);
    const res = await this.executor.request<{ run?: NexumRun } & NexumRun>(
      `/runs/${encoded}`,
      { method: "GET", signal },
    );
    return res.run ?? res;
  }

  async cancel(runId: string, signal?: AbortSignal): Promise<void> {
    const encoded = encodeURIComponent(runId);
    await this.executor.request(`/runs/${encoded}/cancel`, {
      method: "POST",
      signal,
    });
  }
}
