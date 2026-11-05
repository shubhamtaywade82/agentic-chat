import { describe, expect, it } from "vitest"
import { applyWireEvent, finishMessage, readWireEvents } from "@/lib/apply-wire-event"
import type { AgentMessage } from "@/lib/agent-types"

const running = (): AgentMessage => ({ id: "a1", role: "agent", status: "running", trace: [], totalTokens: 0, iterations: 0 })

describe("applyWireEvent", () => {
  it("should add up token usage across model calls and keep the latest model", () => {
    let m = applyWireEvent(running(), { kind: "usage", model: "quick", tokensIn: 10, tokensOut: 5 })
    m = applyWireEvent(m, { kind: "usage", model: "beam:cloud", tokensIn: 3, tokensOut: 2 })
    expect(m).toMatchObject({ model: "beam:cloud", totalTokens: 20 })
  })

  it("should keep an approval pending until it is resolved", () => {
    let m = applyWireEvent(running(), { kind: "interaction", status: "pending", interaction: "approval", interactionId: "i1" })
    expect(m.trace?.at(-1)?.status).toBe("pending")
    m = applyWireEvent(m, { kind: "interaction_resolved", interactionId: "i1", resolution: { approved: false } })
    expect(m.trace?.at(-1)).toMatchObject({ status: "completed", resolution: { approved: false } })
  })

  it("should drop the answer draft once the final answer arrives", () => {
    let m = applyWireEvent(running(), { kind: "answer_delta", content: "Hel" })
    m = applyWireEvent(m, { kind: "answer", iteration: 1, content: "Hello" })
    expect(m.draftAnswer).toBeUndefined()
    expect(m.trace?.at(-1)).toMatchObject({ kind: "answer", content: "Hello", status: "completed" })
  })
})

describe("finishMessage", () => {
  it("should mark the turn as an error when its last step failed", () => {
    const m = applyWireEvent(running(), { kind: "answer", content: "⚠️ cannot reach Nexum", error: true })
    expect(finishMessage(m).status).toBe("error")
  })

  it("should complete a turn that ended with an answer", () => {
    const m = applyWireEvent(running(), { kind: "answer", content: "ok" })
    expect(finishMessage(m)).toMatchObject({ status: "completed", draftAnswer: undefined })
  })
})

describe("readWireEvents", () => {
  it("should yield events split across chunks and stop at [DONE]", async () => {
    const chunks = ['data: {"kind":"run","runId":"r1"}\n\ndata: {"kind":"an', 'swer","content":"x"}\n\ndata: [DONE]\n\n']
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c))
        controller.close()
      },
    })
    const events: unknown[] = []
    for await (const e of readWireEvents(body)) events.push(e)
    expect(events).toEqual([{ kind: "run", runId: "r1" }, { kind: "answer", content: "x" }])
  })
})
