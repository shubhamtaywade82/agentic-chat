/**
 * Backwards-compatibility adapter pointing to the formal Nexum Client SDK
 * under src/lib/nexum/.
 */

import { NexumClient } from "./nexum/client";
import type { CreateRunParams, RunEventEnvelope } from "./nexum/types";
import { NexumError } from "./nexum/errors";

export * from "./nexum";

export type NexumRunEvent = RunEventEnvelope["payload"] & {
  type: string;
  runId?: string;
  ts?: number;
  [key: string]: unknown;
};

export function nexumHostUrl(): string {
  const raw = process.env.NEXUM_HOST_URL ?? process.env.NEXUM_SERVER_URL ?? "http://127.0.0.1:3777";
  return raw.replace(/\/$/, "");
}

export class NexumHostError extends NexumError {}

export async function createNexumSession(baseUrl: string): Promise<string> {
  const client = new NexumClient({ baseUrl });
  const session = await client.sessions.create();
  return session.id;
}

export async function* streamNexumRun(
  baseUrl: string,
  sessionId: string,
  params: CreateRunParams,
  signal?: AbortSignal,
): AsyncGenerator<NexumRunEvent> {
  const client = new NexumClient({ baseUrl });
  const run = await client.runs.create(sessionId, params, signal);
  for await (const envelope of client.events.stream(run.id, { signal })) {
    const event = (envelope.payload ?? envelope) as NexumRunEvent;
    if (!event.runId) event.runId = envelope.runId;
    if (!event.ts) event.ts = envelope.ts;
    yield event;
  }
}
