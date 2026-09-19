/**
 * Thin client for the Nexum Local Host's Session/Run/Event API
 * (nexum's src/protocol/types.ts + src/host/server.ts).
 *
 * This is the Phase 4 compatibility adapter (see the merge architecture
 * doc): when NEXUM_HOST_URL is set, /api/agent proxies to a running
 * `nexum serve` process instead of running the in-process ReAct loop.
 * When unset, the existing in-process loop in route.ts is untouched.
 *
 * Scope for this first vertical slice: one ephemeral Nexum session per
 * chat turn (not per browser ChatSession) — agentic-chat already resends
 * full `history` per request today, so this preserves that stateless-per-
 * request shape. Cross-turn continuity living on the Nexum side (so the
 * agent remembers earlier tool calls without replaying history text) is
 * explicitly Phase 5 ("Replace local sessions") work, not this adapter's.
 * Likewise, tool execution and model config for a Nexum-routed turn are
 * whatever the `nexum serve` process itself is configured with — this
 * client does not forward agentic-chat's AgentConfig/live-tools/MCP pool.
 */

export interface NexumRunEvent {
  type: string;
  runId: string;
  ts: number;
  [key: string]: unknown;
}

export function nexumHostUrl(): string | null {
  const raw = process.env.NEXUM_HOST_URL;
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export class NexumHostError extends Error {}

export async function createNexumSession(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/sessions`, { method: "POST" });
  if (!res.ok) {
    throw new NexumHostError(`Nexum host POST /sessions failed: ${res.status} ${await safeText(res)}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

/**
 * Starts a run and yields each NexumRunEvent as the host streams it.
 * Mirrors the SSE framing agentic-chat's own /api/agent route already
 * uses (`data: <json>\n\n`), so the parsing logic here is deliberately
 * the same shape as src/store/agent-store.ts's reader loop.
 */
export async function* streamNexumRun(
  baseUrl: string,
  sessionId: string,
  goal: string,
  signal?: AbortSignal,
): AsyncGenerator<NexumRunEvent> {
  const res = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new NexumHostError(`Nexum host run failed: ${res.status} ${await safeText(res)}`);
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
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const line = raw.replace(/^data:\s*/, "").trim();
        if (!line) continue;
        try {
          yield JSON.parse(line) as NexumRunEvent;
        } catch {
          // malformed SSE line — skip rather than abort the whole run
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "";
  }
}
