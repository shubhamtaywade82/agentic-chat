import { describe, expect, it } from "vitest"
import { newTurnState, translateNexumEvent } from "@/lib/nexum/wire"

const translate = (event: { type: string; [key: string]: unknown }, state = newTurnState()) =>
  translateNexumEvent(event, state)

describe("translateNexumEvent", () => {
  it("should expose the run id when the run starts", () => {
    expect(translate({ type: "run.started", runId: "r1" })).toEqual([{ kind: "run", runId: "r1" }])
  })

  it("should number tool iterations so an observation lines up with its call", () => {
    const state = newTurnState()

    const [call] = translate({ type: "tool.started", callId: "c1", name: "read_file", args: { path: "a" } }, state)
    const [observation] = translate(
      { type: "tool.completed", callId: "c1", name: "read_file", result: { summary: "ok" } },
      state,
    )
    const [next] = translate({ type: "thought", text: "next" }, state)

    expect(call).toMatchObject({ kind: "tool_call", iteration: 1, toolName: "read_file" })
    expect(observation).toMatchObject({ kind: "observation", iteration: 1, summary: "ok" })
    expect(next).toMatchObject({ kind: "thinking", iteration: 2 })
  })

  it("should summarise a tool result that has no summary field, truncated", () => {
    const [observation] = translate({
      type: "tool.completed",
      callId: "c1",
      name: "x",
      result: { big: "y".repeat(500) },
    })

    expect((observation.summary as string).length).toBe(200)
  })

  it("should relay an approval request as a pending interaction, and its resolution separately", () => {
    const [required] = translate({
      type: "run.approval.required",
      interactionId: "a1",
      title: "Delete files",
      summary: "rm -rf x",
    })
    const [resolved] = translate({ type: "run.approval.resolved", interactionId: "a1", approved: false })

    expect(required).toMatchObject({ kind: "interaction", status: "pending", interaction: "approval", interactionId: "a1" })
    expect(resolved).toEqual({ kind: "interaction_resolved", interactionId: "a1", resolution: { approved: false } })
  })

  it("should relay a clarification with its options", () => {
    const options = [{ id: "a", label: "A" }]

    const [required] = translate({ type: "run.clarification.required", interactionId: "c", question: "Which?", options })
    const [resolved] = translate({ type: "run.clarification.resolved", interactionId: "c", selectedId: "a" })

    expect(required).toMatchObject({ interaction: "clarification", question: "Which?", options })
    expect(resolved).toMatchObject({ resolution: { selectedId: "a" } })
  })

  it.each(["markdown", "openui"] as const)("should carry the %s format Nexum reported on the answer", (format) => {
    const [answer] = translate({ type: "run.completed", output: { format, content: "x" } })

    expect(answer).toMatchObject({ kind: "answer", content: "x", format })
  })

  it.each([
    [{ type: "run.failed", error: "boom" }, "Agent Error"],
    [{ type: "run.cancelled" }, "cancelled"],
    [{ type: "run.interrupted", reason: "restart" }, "Interrupted"],
  ])("should end the turn with a readable answer for %j", (event, text) => {
    const [answer] = translate(event)

    expect(answer).toMatchObject({ kind: "answer" })
    expect(answer.content as string).toContain(text)
  })

  it("should ignore events with nothing to render", () => {
    expect(translate({ type: "model.used", tier: "fast", model: "m" })).toEqual([])
  })
})
