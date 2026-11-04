import type { NexumCapabilities } from "./types";
import type { RequestExecutor } from "./sessions";

export class NexumCapabilitiesClient {
  constructor(private readonly executor: RequestExecutor) {}

  async get(signal?: AbortSignal): Promise<NexumCapabilities> {
    return this.executor.request<NexumCapabilities>("/capabilities", {
      method: "GET",
      signal,
    });
  }

  async health(signal?: AbortSignal): Promise<{ status: string }> {
    return this.executor.request<{ status: string }>("/health", {
      method: "GET",
      signal,
    });
  }

  async ready(signal?: AbortSignal): Promise<{ status: string; checks: Record<string, string> }> {
    return this.executor.request<{ status: string; checks: Record<string, string> }>("/ready", {
      method: "GET",
      signal,
    });
  }
}
