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
