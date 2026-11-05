import { afterEach, describe, expect, it, vi } from "vitest"
import { useAgentStore } from "@/store/agent-store"

function sseResponse(events: object[]): Response {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n"
  return new Response(text, { headers: { "X-Nexum-Session-Id": "nx-1" } })
}

afterEach(() => vi.unstubAllGlobals())

describe("agent store", () => {
  it("should save a turn into the chat that started it when the user switches chats mid-run", async () => {
    let release: (r: Response) => void = () => {}
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))))
    const store = useAgentStore.getState()
    store.createNewSession()
    const otherChat = useAgentStore.getState().activeSessionId
    store.createNewSession()
    const runChat = useAgentStore.getState().activeSessionId

    const turn = useAgentStore.getState().sendUserMessage("list primes")
    useAgentStore.getState().switchSession(otherChat)
    release(sseResponse([{ kind: "answer", content: "2, 3, 5" }]))
    await turn

    const { sessions } = useAgentStore.getState()
    const run = sessions.find((s) => s.id === runChat)!
    const other = sessions.find((s) => s.id === otherChat)!
    expect(run.messages.at(-1)).toMatchObject({ status: "completed" })
    expect(run.messages.at(-1)?.trace?.at(-1)).toMatchObject({ content: "2, 3, 5" })
    expect(run.nexumSessionId).toBe("nx-1")
    expect(other).toMatchObject({ title: "New Chat", messages: [] })
  })

  it("should forget the Nexum session when a chat is cleared", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([{ kind: "answer", content: "ok" }])))
    useAgentStore.getState().createNewSession()
    await useAgentStore.getState().sendUserMessage("remember KIWI77")
    useAgentStore.getState().clear()

    const { sessions, activeSessionId, messages } = useAgentStore.getState()
    expect(messages).toEqual([])
    expect(sessions.find((s) => s.id === activeSessionId)?.nexumSessionId).toBeUndefined()
  })
})
