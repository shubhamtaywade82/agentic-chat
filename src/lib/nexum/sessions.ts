import type { NexumSession, CreateSessionParams } from "./types";

export interface RequestExecutor {
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

export class NexumSessionsClient {
  constructor(private readonly executor: RequestExecutor) {}

  async create(params?: CreateSessionParams, signal?: AbortSignal): Promise<NexumSession> {
    return this.executor.request<NexumSession>("/sessions", {
      method: "POST",
      body: JSON.stringify(params ?? {}),
      signal,
    });
  }

  async get(id: string, signal?: AbortSignal): Promise<NexumSession> {
    const encoded = encodeURIComponent(id);
    return this.executor.request<NexumSession>(`/sessions/${encoded}`, {
      method: "GET",
      signal,
    });
  }

  async list(signal?: AbortSignal): Promise<NexumSession[]> {
    const res = await this.executor.request<{ sessions: NexumSession[] }>("/sessions", {
      method: "GET",
      signal,
    });
    return res.sessions ?? [];
  }
}
