import { NextRequest } from "next/server"
import { buildNexumOpenUISpec } from "@/lib/openui/prompt"
import { NexumClient, NexumHttpError, type CreateRunParams } from "@/lib/nexum"
import { createNexumSession, nexumHostUrl } from "@/lib/nexum-client"
import { newTurnState, translateNexumEvent, type NexumEvent } from "@/lib/nexum/wire"

type Send = (data: Record<string, unknown>) => void

/**
 * Starts the turn's run, or, when the chat's session already has one in
 * progress (a second tab, or a cancelled run still winding down), follows
 * that run instead and says so. The new message is not sent in that case.
 */
async function openRun(client: NexumClient, sessionId: string, params: CreateRunParams, send: Send): Promise<string> {
  try {
    return (await client.runs.create(sessionId, params)).id
  } catch (err) {
    const activeRunId = activeRunOfConflict(err)
    if (!activeRunId) throw err
    send({
      kind: "thinking",
      iteration: 1,
      title: "A run is already active in this chat",
      reasoning: "Your message was not sent. Showing the run in progress; send it again once it finishes.",
    })
    return activeRunId
  }
}

function activeRunOfConflict(err: unknown): string | null {
  if (!(err instanceof NexumHttpError) || err.status !== 409) return null
  try {
    const body = JSON.parse(err.body ?? "") as { error?: string; runId?: unknown }
    return body.error === "run_in_progress" && typeof body.runId === "string" ? body.runId : null
  } catch {
    return null
  }
}

/**
 * Runs one turn through Nexum and relays its events as wire events (see
 * src/lib/nexum/wire.ts). When `signal` aborts, the browser has gone away —
 * nobody can answer an approval any more — so the Nexum run is cancelled
 * rather than left running or blocked.
 */
async function runViaNexum(
  send: Send,
  baseUrl: string,
  sessionId: string,
  params: CreateRunParams,
  signal: AbortSignal,
): Promise<void> {
  const client = new NexumClient({ baseUrl })
  const state = newTurnState()
  try {
    const runId = await openRun(client, sessionId, params, send)
    const cancelRun = () => void client.runs.cancel(runId).catch(() => {})
    if (signal.aborted) cancelRun()
    else signal.addEventListener("abort", cancelRun, { once: true })

    for await (const envelope of client.events.stream(runId, { signal })) {
      const event = (envelope.payload ?? envelope) as NexumEvent
      if (!event.runId) event.runId = envelope.runId
      for (const wireEvent of translateNexumEvent(event, state)) send(wireEvent)
    }
  } catch (err: unknown) {
    if (signal.aborted) return
    const message = err instanceof Error ? err.message : String(err)
    send({ kind: "answer", iteration: state.iteration, content: `⚠️ **Agent Error** (Nexum host): ${message}` })
  }
}

export async function POST(req: NextRequest) {
  const { query, openuiEnabled, nexumSessionId } = (await req.json()) as {
    query: string
    openuiEnabled?: boolean
    /** The Nexum session from a prior turn in this chat, if one exists; reused so
     * the conversation stays continuous on the Nexum side. */
    nexumSessionId?: string
  }

  // Resolved (or created) BEFORE the stream starts, not inside it, so it
  // can ride back to the client as a response header — src/store/agent-store.ts
  // persists it onto the ChatSession for the next turn to reuse.
  const nexumUrl = nexumHostUrl()
  let resolvedNexumSessionId: string | null = null
  try {
    resolvedNexumSessionId = nexumSessionId || (await createNexumSession(nexumUrl))
  } catch {
    // Surfaced as an answer-shaped error inside the stream below.
  }

  // Aborts when the browser disconnects (Stop, refresh, closed tab); see runViaNexum.
  const disconnected = new AbortController()
  req.signal.addEventListener("abort", () => disconnected.abort())

  const encoder = new TextEncoder()
  let closed = false
  const stream = new ReadableStream({
    async start(controller) {
      const send: Send = (data) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      if (resolvedNexumSessionId) {
        // Nexum decides whether UI fits the answer and labels the format;
        // the client only offers its component spec.
        const runParams: CreateRunParams = openuiEnabled
          ? { goal: query, interactive: true, outputFormat: "openui", openuiSpec: buildNexumOpenUISpec() }
          : { goal: query, interactive: true }
        await runViaNexum(send, nexumUrl, resolvedNexumSessionId, runParams, disconnected.signal)
      } else {
        send({ kind: "answer", iteration: 1, content: `⚠️ **Agent Error**: could not reach Nexum at ${nexumUrl} — is \`nexum serve\` running?` })
      }
      if (!closed) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
        closed = true
      }
    },
    cancel() {
      closed = true
      disconnected.abort()
    },
  })

  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  }
  if (resolvedNexumSessionId) headers["X-Nexum-Session-Id"] = resolvedNexumSessionId

  return new Response(stream, { headers })
}
