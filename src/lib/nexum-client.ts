/**
 * Thin client for the Nexum Local Host's Session/Run/Event API
 * (nexum's src/protocol/types.ts + src/host/server.ts).
 *
 * When NEXUM_HOST_URL is set, /api/agent proxies to a running `nexum
 * serve` process instead of running the in-process ReAct loop. When
 * unset, the existing in-process loop in route.ts is untouched.
 *
 * Session continuity (Phase 5 — "Unified Sessions + Runs"): one Nexum
 * session is created per browser ChatSession (on its first turn) and
 * reused for every subsequent turn — route.ts passes the id back via the
 * X-Nexum-Session-Id response header, and src/store/agent-store.ts
 * persists it onto the ChatSession. Nexum's own AgentRuntime keeps that
 * session's conversation state (src/host/agent-registry.ts on the nexum
 * side), so a Nexum-routed chat has real multi-turn memory now, not just
 * the `history` array agentic-chat still also sends for the in-process
 * fallback path.
 *
 * Still out of scope for this adapter: tool execution and model config
 * for a Nexum-routed turn come from whatever `nexum serve` itself is
 * configured with, not from agentic-chat's AgentConfig/live-tools/MCP
 * pool — unifying those is a later phase (ModelGateway / ToolGateway).
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
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.NEXUM_SERVER_TOKEN || process.env.NEXUM_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}/sessions`, { method: "POST", headers });
  if (!res.ok) {
    throw new NexumHostError(`Nexum host POST /sessions failed: ${res.status} ${await safeText(res)}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

/**
 * Starts a run and yields each NexumRunEvent as the host streams it.
 * Conforms to Server Protocol v1: POST /sessions/:id/runs returns 201 Created
 * with { run: { id } }, and live events are streamed via GET /runs/:id/events.
 */
export async function* streamNexumRun(
  baseUrl: string,
  sessionId: string,
  goal: string,
  signal?: AbortSignal,
): AsyncGenerator<NexumRunEvent> {
  const token = process.env.NEXUM_SERVER_TOKEN || process.env.NEXUM_TOKEN;
  const authHeaders: Record<string, string> = {};
  if (token) authHeaders["Authorization"] = `Bearer ${token}`;

  const runRes = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/runs`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
    signal,
  });

  if (!runRes.ok) {
    throw new NexumHostError(`Nexum host run creation failed: ${runRes.status} ${await safeText(runRes)}`);
  }

  const { run } = (await runRes.json()) as { run: { id: string } };

  const sseRes = await fetch(`${baseUrl}/runs/${encodeURIComponent(run.id)}/events`, {
    headers: { ...authHeaders, Accept: "text/event-stream" },
    signal,
  });

  if (!sseRes.ok || !sseRes.body) {
    throw new NexumHostError(`Nexum host run stream failed: ${sseRes.status} ${await safeText(sseRes)}`);
  }

  const reader = sseRes.body.getReader();
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
        const dataLine = raw
          .split("\n")
          .find((l) => l.startsWith("data:"))
          ?.replace(/^data:\s*/, "")
          .trim();
        if (!dataLine) continue;
        try {
          const parsed = JSON.parse(dataLine) as { payload?: NexumRunEvent; type?: string };
          const event = (parsed.payload ?? parsed) as NexumRunEvent;
          yield event;
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
