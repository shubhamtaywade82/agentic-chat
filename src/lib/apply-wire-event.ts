import type { AgentMessage, InteractionStep, TraceStep } from "./agent-types"

/** One event of the /api/agent stream (see src/lib/nexum/wire.ts). */
export type WireEvent = { kind: string; [field: string]: unknown }

/** Folds one wire event into the agent message of the turn it belongs to. */
export function applyWireEvent(message: AgentMessage, event: WireEvent, now = Date.now()): AgentMessage {
  switch (event.kind) {
    case "usage":
      return {
        ...message,
        model: event.model as string,
        totalTokens: (message.totalTokens ?? 0) + Number(event.tokensIn ?? 0) + Number(event.tokensOut ?? 0),
      }
    case "answer_delta":
      return { ...message, draftAnswer: (message.draftAnswer ?? "") + String(event.content) }
    case "thinking_delta":
      return { ...message, draftThinking: (message.draftThinking ?? "") + String(event.content) }
    case "interaction_resolved":
      return patchInteraction(message, (t) => t.interactionId === event.interactionId, {
        status: "completed",
        finishedAt: now,
        resolution: event.resolution as InteractionStep["resolution"],
        error: undefined,
      })
    default:
      return appendStep(message, event, now)
  }
}

function appendStep(message: AgentMessage, event: WireEvent, now: number): AgentMessage {
  const iteration = Number(event.iteration) || message.iterations || 1
  const step = {
    ...event,
    id: `step_${message.trace?.length ?? 0}_${now}`,
    // Interactions arrive "pending"; everything else is finished the moment it is reported.
    status: event.status ?? (event.error ? "error" : "completed"),
    iteration,
    startedAt: now,
    finishedAt: now,
  } as unknown as TraceStep
  return {
    ...message,
    // The final event supersedes its draft; text streamed before a tool call was narration.
    draftThinking: event.kind === "thinking" ? undefined : message.draftThinking,
    draftAnswer: event.kind === "tool_call" || event.kind === "answer" ? undefined : message.draftAnswer,
    trace: [...(message.trace ?? []), step],
    iterations: iteration,
  }
}

export function patchInteraction(
  message: AgentMessage,
  match: (step: InteractionStep) => boolean,
  patch: Partial<InteractionStep>,
): AgentMessage {
  return { ...message, trace: message.trace?.map((t) => (t.kind === "interaction" && match(t) ? { ...t, ...patch } : t)) }
}

/**
 * Ends the turn: pending interactions can no longer be answered, drafts are dropped, and the message is an
 * error when its last step is one. `endStep` is appended first (a cancellation or transport failure).
 */
export function finishMessage(message: AgentMessage, endStep?: TraceStep, now = Date.now()): AgentMessage {
  const closed = patchInteraction(message, (t) => t.status === "pending", { status: "completed", finishedAt: now })
  const trace = endStep ? [...(closed.trace ?? []), endStep] : (closed.trace ?? [])
  const failed = trace.at(-1)?.status === "error"
  return {
    ...closed,
    trace,
    status: failed ? "error" : "completed",
    finishedAt: now,
    draftAnswer: undefined,
    draftThinking: undefined,
  }
}

/** Yields the `data:` events of an SSE body until `[DONE]` or the end of the stream. */
export async function* readWireEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<WireEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split("\n\n")
    buffer = frames.pop() ?? ""
    for (const frame of frames) {
      const line = frame.trim()
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (data === "[DONE]") return
      yield JSON.parse(data) as WireEvent
    }
  }
}
