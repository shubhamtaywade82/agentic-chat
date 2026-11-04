import type { RunEventEnvelope } from "./types";
import { NexumHttpError } from "./errors";

export interface StreamEventsOptions {
  lastEventId?: string | number;
  signal?: AbortSignal;
}

export interface EventsUrlBuilder {
  buildUrl(path: string): string;
  getAuthHeaders(): Record<string, string>;
}

export class NexumEventsClient {
  constructor(private readonly context: EventsUrlBuilder) {}

  async *stream(
    runId: string,
    options: StreamEventsOptions = {},
  ): AsyncGenerator<RunEventEnvelope> {
    const url = this.context.buildUrl(`/runs/${encodeURIComponent(runId)}/events`);
    const headers: Record<string, string> = {
      ...this.context.getAuthHeaders(),
      Accept: "text/event-stream",
    };
    if (options.lastEventId !== undefined) {
      headers["Last-Event-ID"] = String(options.lastEventId);
    }

    const res = await fetch(url, { headers, signal: options.signal });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new NexumHttpError(
        `Failed to stream events: ${res.status} ${res.statusText}`,
        res.status,
        res.statusText,
        errText,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const parsed = this.parseChunk(chunk);
          if (parsed) yield parsed;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseChunk(chunk: string): RunEventEnvelope | null {
    let id: string | undefined;
    let eventName: string | undefined;
    let data = "";

    for (const line of chunk.split("\n")) {
      if (line.startsWith("id:")) id = line.slice(3).trim();
      else if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(5).trim();
    }

    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      const envelope = (parsed.payload ? parsed : { payload: parsed }) as RunEventEnvelope;
      if (id && !envelope.id) envelope.id = id;
      if (eventName && !envelope.type) envelope.type = eventName;
      return envelope;
    } catch {
      return null;
    }
  }
}
