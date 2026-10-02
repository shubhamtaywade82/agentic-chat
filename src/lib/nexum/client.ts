import type { NexumClientOptions } from "./types";
import { NexumHttpError, NexumConnectionError, NexumTimeoutError } from "./errors";
import { NexumSessionsClient, type RequestExecutor } from "./sessions";
import { NexumRunsClient } from "./runs";
import { NexumEventsClient, type EventsUrlBuilder } from "./events";
import { NexumInteractionsClient } from "./interactions";
import { NexumCapabilitiesClient } from "./capabilities";
import { NexumToolsClient } from "./tools";

export class NexumClient implements RequestExecutor, EventsUrlBuilder {
  readonly baseUrl: string;
  readonly token?: string;
  readonly timeoutMs: number;

  readonly sessions: NexumSessionsClient;
  readonly runs: NexumRunsClient;
  readonly events: NexumEventsClient;
  readonly interactions: NexumInteractionsClient;
  readonly capabilities: NexumCapabilitiesClient;
  readonly tools: NexumToolsClient;

  constructor(options: NexumClientOptions = {}) {
    const rawUrl =
      options.baseUrl ??
      (typeof process !== "undefined"
        ? process.env.NEXUM_HOST_URL ?? process.env.NEXUM_SERVER_URL
        : undefined) ??
      "http://127.0.0.1:3777";
    this.baseUrl = rawUrl.replace(/\/$/, "");
    this.token =
      options.token ??
      (typeof process !== "undefined"
        ? process.env.NEXUM_SERVER_TOKEN ?? process.env.NEXUM_TOKEN
        : undefined);
    this.timeoutMs = options.timeoutMs ?? 30_000;

    this.sessions = new NexumSessionsClient(this);
    this.runs = new NexumRunsClient(this);
    this.events = new NexumEventsClient(this);
    this.interactions = new NexumInteractionsClient(this);
    this.capabilities = new NexumCapabilitiesClient(this);
    this.tools = new NexumToolsClient(this);
  }

  buildUrl(path: string): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = this.buildUrl(path);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.getAuthHeaders(),
      ...(init.headers as Record<string, string>),
    };

    let controller: AbortController | undefined;
    let timer: NodeJS.Timeout | undefined;

    if (!init.signal && this.timeoutMs > 0) {
      controller = new AbortController();
      timer = setTimeout(() => controller?.abort(), this.timeoutMs);
    }

    try {
      const res = await fetch(url, {
        ...init,
        headers,
        signal: init.signal ?? controller?.signal,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new NexumHttpError(
          `Nexum request failed [${res.status} ${res.statusText}]: ${url}`,
          res.status,
          res.statusText,
          bodyText,
        );
      }

      if (res.status === 204) {
        return undefined as unknown as T;
      }
      return (await res.json()) as T;
    } catch (err: unknown) {
      if (err instanceof NexumHttpError) throw err;
      if (controller?.signal.aborted) {
        throw new NexumTimeoutError(`Nexum request timed out after ${this.timeoutMs}ms: ${url}`);
      }
      throw new NexumConnectionError(`Failed to connect to Nexum server at ${url}`, err);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
