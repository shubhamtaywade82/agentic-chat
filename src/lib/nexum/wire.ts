import type { NexumRunOutput } from "./types"

/**
 * Translates Nexum run events into the `{ kind, iteration, ... }` wire events
 * that /api/agent streams to the browser (consumed by src/store/agent-store.ts).
 */

export interface TurnState {
  iteration: number
  toolIteration: Map<string, number>
}

export type WireEvent = Record<string, unknown>

/** A Nexum event as it arrives off the stream: `type` plus the event's own fields. */
export type NexumEvent = { type: string; [key: string]: unknown }

export function newTurnState(): TurnState {
  return { iteration: 1, toolIteration: new Map() }
}

export function translateNexumEvent(event: NexumEvent, state: TurnState): WireEvent[] {
  const e = event as Record<string, any>
  switch (event.type) {
    case "run.started":
      return [{ kind: "run", runId: e.runId }]
    case "plan.updated":
      return [{ kind: "plan", iteration: state.iteration, goal: e.goal, steps: e.steps }]
    case "thought":
      return [
        {
          kind: "thinking",
          iteration: state.iteration,
          title: state.iteration === 1 ? "Analyzing user query & plan" : `Iterative reasoning (cycle ${state.iteration})`,
          reasoning: e.text,
        },
      ]
    case "tool.started":
      state.toolIteration.set(e.callId, state.iteration)
      return [
        {
          kind: "tool_call",
          iteration: state.iteration,
          toolName: e.name,
          description: `Calling ${e.name} with parameters`,
          args: e.args,
        },
      ]
    case "tool.completed":
      return [toObservation(e, state)]
    case "run.approval.required":
      return [
        {
          kind: "interaction",
          status: "pending",
          iteration: state.iteration,
          interaction: "approval",
          interactionId: e.interactionId,
          title: e.title,
          summary: e.summary,
        },
      ]
    case "run.clarification.required":
      return [
        {
          kind: "interaction",
          status: "pending",
          iteration: state.iteration,
          interaction: "clarification",
          interactionId: e.interactionId,
          question: e.question,
          options: e.options,
        },
      ]
    case "run.approval.resolved":
      return [{ kind: "interaction_resolved", interactionId: e.interactionId, resolution: { approved: e.approved } }]
    case "run.clarification.resolved":
      return [{ kind: "interaction_resolved", interactionId: e.interactionId, resolution: { selectedId: e.selectedId } }]
    case "run.completed": {
      const output = e.output as NexumRunOutput
      return [{ kind: "answer", iteration: state.iteration, content: output.content, openuiActive: output.format === "openui" }]
    }
    case "run.failed":
      return [answer(state, `⚠️ **Agent Error**: ${e.error}`)]
    case "run.cancelled":
      return [answer(state, "⚠️ Run cancelled.")]
    case "run.interrupted":
      return [answer(state, `⚠️ **Run Interrupted**: ${e.reason}`)]
    default:
      // model.used has no matching trace step kind — nothing to render.
      return []
  }
}

function answer(state: TurnState, content: string): WireEvent {
  return { kind: "answer", iteration: state.iteration, content }
}

function toObservation(e: Record<string, any>, state: TurnState): WireEvent {
  const iteration = state.toolIteration.get(e.callId) ?? state.iteration
  const summary = typeof e.result?.summary === "string" ? (e.result.summary as string) : JSON.stringify(e.result).slice(0, 200)
  state.iteration = iteration + 1
  return { kind: "observation", iteration, source: e.name, summary, data: e.result }
}
