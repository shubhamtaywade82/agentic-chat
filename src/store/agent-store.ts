"use client"

import { create } from "zustand"
import type { AgentConfig, AgentMessage, TraceStep } from "@/lib/agent-types"
import { DEFAULT_CONFIG } from "@/lib/agent-types"
import { buildScript, realizeStep } from "@/lib/agent-simulator"

interface AgentState {
  messages: AgentMessage[]
  isRunning: boolean
  activeMessageId: string | null
  speed: number // multiplier for delays (1 = real-time)
  config: AgentConfig
  sidebarCollapsed: boolean
  // run a new agent turn for a user query
  sendUserMessage: (text: string) => void
  setSpeed: (s: number) => void
  updateConfig: (partial: Partial<AgentConfig>) => void
  toggleTool: (name: string) => void
  resetConfig: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  clear: () => void
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [
    {
      id: "welcome",
      role: "agent",
      status: "completed",
      query: "welcome",
      startedAt: Date.now(),
      finishedAt: Date.now(),
      iterations: 0,
      totalTokens: 0,
      modelId: DEFAULT_CONFIG.modelId,
      systemPrompt: DEFAULT_CONFIG.systemPrompt,
      trace: [
        {
          id: "welcome_answer",
          kind: "answer",
          status: "completed",
          iteration: 1,
          startedAt: Date.now(),
          finishedAt: Date.now(),
          content:
            "👋 Welcome to the **Agentic ReAct Playground**.\n\nWatch me think, call tools, and observe results before answering. Try asking:\n\n- *\"What's the weather in Tokyo?\"*\n- *\"Calculate 15 * 23 + 7\"*\n- *\"Write a Python function for Fibonacci\"*\n- *\"Research how transformers work\"*\n\nYou'll see the full **Reason → Act → Observe** loop visualized in real time.\n\n*Tweak the agent configuration in the left sidebar — model, system prompt, temperature, max iterations, and which tools are enabled all affect how I run.*",
        },
      ],
    },
  ],
  isRunning: false,
  activeMessageId: null,
  speed: 1,
  config: { ...DEFAULT_CONFIG, enabledTools: { ...DEFAULT_CONFIG.enabledTools } },
  sidebarCollapsed: false,

  setSpeed: (s) => set({ speed: s }),

  updateConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  toggleTool: (name) =>
    set((s) => ({
      config: {
        ...s.config,
        enabledTools: {
          ...s.config.enabledTools,
          [name]: s.config.enabledTools[name] === false ? true : false,
        },
      },
    })),

  resetConfig: () =>
    set({
      config: {
        ...DEFAULT_CONFIG,
        enabledTools: { ...DEFAULT_CONFIG.enabledTools },
      },
    }),

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  clear: () =>
    set({
      messages: [],
      isRunning: false,
      activeMessageId: null,
    }),

  sendUserMessage: async (text) => {
    if (get().isRunning) return
    const config = get().config
    const userMsg: AgentMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
    }
    const agentMsgId = `a_${Date.now()}`
    const agentMsg: AgentMessage = {
      id: agentMsgId,
      role: "agent",
      query: text,
      trace: [],
      status: "running",
      startedAt: Date.now(),
      iterations: 0,
      totalTokens: 0,
      modelId: config.modelId,
      systemPrompt: config.systemPrompt,
      temperature: config.temperature,
      maxIterations: config.maxIterations,
    }
    set((s) => ({
      messages: [...s.messages, userMsg, agentMsg],
      isRunning: true,
      activeMessageId: agentMsgId,
    }))

    const script = buildScript(text, config)
    const speed = get().speed
    let iteration = 0
    let tokens = 0

    for (const scripted of script) {
      if (scripted.type === "thinking") iteration += 1
      await sleep(scripted.delay / speed)
      const step = realizeStep(scripted, iteration) as TraceStep

      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === agentMsgId
            ? { ...m, trace: [...(m.trace ?? []), step], iterations: iteration }
            : m
        ),
      }))

      const workMs =
        scripted.type === "observation"
          ? 700
          : scripted.type === "tool_call"
          ? 500
          : scripted.type === "answer"
          ? 250
          : 400
      await sleep(workMs / speed)

      const finishedAt = Date.now()
      const durationMs = finishedAt - step.startedAt
      const stepTokens =
        scripted.type === "thinking"
          ? (scripted.tokensIn ?? 0) + (scripted.tokensOut ?? 0)
          : scripted.type === "answer"
          ? 120
          : scripted.type === "tool_call"
          ? 40
          : scripted.type === "observation"
          ? 80
          : 0
      tokens += stepTokens

      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                trace: (m.trace ?? []).map((t) =>
                  t.id === step.id ? { ...t, status: "completed", finishedAt, durationMs } : t
                ),
                totalTokens: tokens,
              }
            : m
        ),
      }))
    }

    set((s) => ({
      isRunning: false,
      activeMessageId: null,
      messages: s.messages.map((m) =>
        m.id === agentMsgId
          ? { ...m, status: "completed", finishedAt: Date.now() }
          : m
      ),
    }))
  },
}))
