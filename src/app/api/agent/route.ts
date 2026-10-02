import { NextRequest } from "next/server"
import type { AgentConfig, CustomTool } from "@/lib/agent-types"
import { buildNexumOpenUISpec } from "@/lib/openui/prompt"
import { runLegacyReactTurn } from "@/lib/legacy/react-agent"
import { createNexumSession, nexumHostUrl, streamNexumRun, type CreateRunParams, type NexumRunEvent, type NexumRunOutput } from "@/lib/nexum-client"

// Temporary escape hatch for one release while Nexum becomes the sole
// execution path; remove together with src/lib/legacy/.
const useLegacyAgent = process.env.AGENTIC_CHAT_LEGACY_AGENT === "true"

/**
 * Runs one turn through an external `nexum serve` host instead of the
 * in-process ReAct loop below, translating Nexum's NexumRunEvent stream
 * into the exact same `{kind, iteration, ...}` wire events this route has
 * always emitted — src/store/agent-store.ts (the only consumer) needs no
 * changes either way. See src/lib/nexum-client.ts for the scope/limits of
 * this first integration slice (no history/tool-config forwarding yet).
 */
async function runViaNexum(
  send: (data: Record<string, unknown>) => void,
  baseUrl: string,
  sessionId: string,
  runParams: CreateRunParams,
): Promise<void> {
  let iteration = 1
  const toolIteration = new Map<string, number>()

  try {
    for await (const event of streamNexumRun(baseUrl, sessionId, runParams)) {
      switch (event.type) {
        case "plan.updated": {
          const e = event as NexumRunEvent & { goal: string; steps: { id: string; text: string; done: boolean }[] }
          send({ kind: "plan", iteration, goal: e.goal, steps: e.steps })
          break
        }
        case "thought": {
          const e = event as NexumRunEvent & { text: string }
          send({
            kind: "thinking",
            iteration,
            title: iteration === 1 ? "Analyzing user query & plan" : `Iterative reasoning (cycle ${iteration})`,
            reasoning: e.text,
          })
          break
        }
        case "tool.started": {
          const e = event as NexumRunEvent & { callId: string; name: string; args: Record<string, unknown> }
          toolIteration.set(e.callId, iteration)
          send({
            kind: "tool_call",
            iteration,
            toolName: e.name,
            description: `Calling ${e.name} with parameters`,
            args: e.args,
          })
          break
        }
        case "tool.completed": {
          const e = event as NexumRunEvent & { callId: string; name: string; result: Record<string, unknown> }
          const it = toolIteration.get(e.callId) ?? iteration
          const summary =
            typeof e.result?.summary === "string" ? (e.result.summary as string) : JSON.stringify(e.result).slice(0, 200)
          send({ kind: "observation", iteration: it, source: e.name, summary, data: e.result })
          iteration = it + 1
          break
        }
        case "run.completed": {
          const e = event as NexumRunEvent & { output: NexumRunOutput }
          send({ kind: "answer", iteration, content: e.output.content, openuiActive: e.output.format === "openui" })
          break
        }
        case "run.failed": {
          const e = event as NexumRunEvent & { error: string }
          send({ kind: "answer", iteration, content: `⚠️ **Agent Error**: ${e.error}` })
          break
        }
        case "run.cancelled": {
          send({ kind: "answer", iteration, content: "⚠️ Run cancelled." })
          break
        }
        case "run.interrupted": {
          const e = event as NexumRunEvent & { reason: string }
          send({ kind: "answer", iteration, content: `⚠️ **Run Interrupted**: ${e.reason}` })
          break
        }
        // "run.started" and "model.used" have no matching TraceStep kind — nothing to render.
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    send({ kind: "answer", iteration, content: `⚠️ **Agent Error** (Nexum host): ${message}` })
  }
}

export async function POST(req: NextRequest) {
  const { query, history = [], config, customTools = [], nexumSessionId } = (await req.json()) as {
    query: string
    history?: { role: "user" | "assistant"; content: string }[]
    config: AgentConfig
    customTools?: CustomTool[]
    /** A Nexum host session from a prior turn in this chat, if one exists —
     * reused instead of minting a fresh Nexum session per message so the
     * conversation is continuous on the Nexum side too. */
    nexumSessionId?: string
  }

  // Resolved (or created) BEFORE the stream starts, not inside it, so it
  // can ride back to the client as a response header — src/store/agent-store.ts
  // persists it onto the ChatSession for the next turn to reuse.
  const nexumUrl = nexumHostUrl()
  let resolvedNexumSessionId: string | null = null
  if (!useLegacyAgent) {
    try {
      resolvedNexumSessionId = nexumSessionId || (await createNexumSession(nexumUrl))
    } catch {
      // Surfaced as an answer-shaped error inside the stream below.
    }
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      if (useLegacyAgent) {
        await runLegacyReactTurn(send, { query, history, config, customTools })
      } else if (resolvedNexumSessionId) {
        // Nexum decides whether UI fits the answer and labels the format;
        // the client only offers its component spec.
        const runParams: CreateRunParams = config.openuiEnabled
          ? { goal: query, outputFormat: "openui", openuiSpec: buildNexumOpenUISpec() }
          : { goal: query }
        await runViaNexum(send, nexumUrl, resolvedNexumSessionId, runParams)
      } else {
        send({ kind: "answer", iteration: 1, content: `⚠️ **Agent Error**: could not reach Nexum at ${nexumUrl} — is \`nexum serve\` running?` })
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
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
