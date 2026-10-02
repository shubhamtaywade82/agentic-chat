/**
 * Backwards-compatibility adapter pointing to the formal Nexum Client SDK
 * under src/lib/nexum/.
 */

import { NexumClient } from "./nexum/client";
import type { RunEventEnvelope } from "./nexum/types";
import { NexumError } from "./nexum/errors";

export * from "./nexum";

export type NexumRunEvent = RunEventEnvelope["payload"] & {
  type: string;
  runId?: string;
  ts?: number;
  [key: string]: unknown;
};

export function nexumHostUrl(): string | null {
  const raw = process.env.NEXUM_HOST_URL ?? process.env.NEXUM_SERVER_URL;
  if (!raw) return null;
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
  goal: string,
  signal?: AbortSignal,
): AsyncGenerator<NexumRunEvent> {
  const client = new NexumClient({ baseUrl });
  const run = await client.runs.create(sessionId, goal, signal);
  for await (const envelope of client.events.stream(run.id, { signal })) {
    const event = (envelope.payload ?? envelope) as NexumRunEvent;
    if (!event.runId) event.runId = envelope.runId;
    if (!event.ts) event.ts = envelope.ts;
    yield event;
  }
}
