"use client"

import { create } from "zustand"
import type { AgentConfig, AgentMessage, ChatSession, CustomTool, TraceStep } from "@/lib/agent-types"
import { DEFAULT_CONFIG } from "@/lib/agent-types"
import { buildScript, realizeStep, uid } from "@/lib/agent-simulator"
import { executeLiveTool } from "@/lib/live-tools"
import { exportTraceToMarkdown, exportTraceToJson, downloadFile } from "@/lib/trace-exporter"

const STORAGE_KEY = "agentic_chat_sessions_v1"
const CONFIG_KEY = "agentic_chat_config_v1"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

interface AgentState {
  sessions: ChatSession[]
  activeSessionId: string
  messages: AgentMessage[]
  isRunning: boolean
  activeMessageId: string | null
  speed: number
  config: AgentConfig
  sidebarCollapsed: boolean

  // Actions
  sendUserMessage: (text: string) => Promise<void>
  setSpeed: (s: number) => void
  updateConfig: (partial: Partial<AgentConfig>) => void
  toggleTool: (name: string) => void
  saveCustomTool: (tool: CustomTool) => void
  deleteCustomTool: (id: string) => void
  toggleCustomTool: (id: string) => void
  resetConfig: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  createNewSession: () => void
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  exportTrace: (messageId: string, format: "md" | "json") => void
  clear: () => void
}

const initialSessionId = `sess_${Date.now()}`
const initialWelcomeMessage: AgentMessage = {
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
        "👋 Welcome to the **Agentic ReAct Playground**.\n\nWatch me decompose tasks, execute tools (Live or Simulated), and observe results before synthesizing a final answer.\n\n- **Live Tools**: Run live calculations, real weather from Open-Meteo, and live Wikipedia search.\n- **Custom Tools**: Create your own JavaScript / HTTP API tools in the sidebar.\n- **Trace Export**: Download full execution traces in Markdown or JSON.",
    },
  ],
}

// Safely load initial state from localStorage if available
function loadSavedState(): { sessions: ChatSession[]; config: AgentConfig } {
  if (typeof window === "undefined") {
    return {
      sessions: [{ id: initialSessionId, title: "Initial Session", createdAt: Date.now(), updatedAt: Date.now(), messages: [initialWelcomeMessage] }],
      config: DEFAULT_CONFIG,
    }
  }
  try {
    const savedSessions = localStorage.getItem(STORAGE_KEY)
    const savedConfig = localStorage.getItem(CONFIG_KEY)
    return {
      sessions: savedSessions ? JSON.parse(savedSessions) : [{ id: initialSessionId, title: "Initial Session", createdAt: Date.now(), updatedAt: Date.now(), messages: [initialWelcomeMessage] }],
      config: savedConfig ? { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) } : DEFAULT_CONFIG,
    }
  } catch {
    return {
      sessions: [{ id: initialSessionId, title: "Initial Session", createdAt: Date.now(), updatedAt: Date.now(), messages: [initialWelcomeMessage] }],
      config: DEFAULT_CONFIG,
    }
  }
}

const saved = loadSavedState()

export const useAgentStore = create<AgentState>((set, get) => ({
  sessions: saved.sessions,
  activeSessionId: saved.sessions[0]?.id || initialSessionId,
  messages: saved.sessions[0]?.messages || [initialWelcomeMessage],
  isRunning: false,
  activeMessageId: null,
  speed: 1,
  config: saved.config,
  sidebarCollapsed: false,

  setSpeed: (s) => set({ speed: s }),

  updateConfig: (partial) => {
    set((s) => {
      const nextConfig = { ...s.config, ...partial }
      if (typeof window !== "undefined") {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(nextConfig))
      }
      return { config: nextConfig }
    })
  },

  toggleTool: (name) => {
    get().updateConfig({
      enabledTools: {
        ...get().config.enabledTools,
        [name]: get().config.enabledTools[name] === false ? true : false,
      },
    })
  },

  saveCustomTool: (tool) => {
    const existing = get().config.customTools || []
    const updated = [...existing.filter((t) => t.id !== tool.id), tool]
    get().updateConfig({ customTools: updated })
  },

  deleteCustomTool: (id) => {
    const updated = (get().config.customTools || []).filter((t) => t.id !== id)
    get().updateConfig({ customTools: updated })
  },

  toggleCustomTool: (id) => {
    const updated = (get().config.customTools || []).map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    get().updateConfig({ customTools: updated })
  },

  resetConfig: () => {
    set({ config: { ...DEFAULT_CONFIG, enabledTools: { ...DEFAULT_CONFIG.enabledTools } } })
    if (typeof window !== "undefined") localStorage.removeItem(CONFIG_KEY)
  },

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  createNewSession: () => {
    const newId = `sess_${Date.now()}`
    const newSession: ChatSession = {
      id: newId,
      title: "New Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }
    set((s) => {
      const sessions = [newSession, ...s.sessions]
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
      return { sessions, activeSessionId: newId, messages: [] }
    })
  },

  switchSession: (id) => {
    const session = get().sessions.find((s) => s.id === id)
    if (session) {
      set({ activeSessionId: id, messages: session.messages })
    }
  },

  deleteSession: (id) => {
    set((s) => {
      const remaining = s.sessions.filter((sess) => sess.id !== id)
      const nextSessions = remaining.length > 0 ? remaining : [{ id: `sess_${Date.now()}`, title: "Initial Session", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }]
      const nextActiveId = nextSessions[0].id
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSessions))
      return { sessions: nextSessions, activeSessionId: nextActiveId, messages: nextSessions[0].messages }
    })
  },

  exportTrace: (messageId, format) => {
    const msg = get().messages.find((m) => m.id === messageId)
    if (!msg) return
    if (format === "md") {
      const md = exportTraceToMarkdown(msg)
      downloadFile(`react-trace-${msg.id}.md`, md, "text/markdown")
    } else {
      const json = exportTraceToJson(msg)
      downloadFile(`react-trace-${msg.id}.json`, json, "application/json")
    }
  },

  clear: () => {
    set((s) => {
      const updatedSessions = s.sessions.map((sess) => (sess.id === s.activeSessionId ? { ...sess, messages: [] } : sess))
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions))
      return { messages: [], isRunning: false, activeMessageId: null, sessions: updatedSessions }
    })
  },

  sendUserMessage: async (text) => {
    if (get().isRunning) return
    const { config, speed, activeSessionId, sessions } = get()
    const userMsg: AgentMessage = { id: `u_${Date.now()}`, role: "user", content: text }
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
      executionMode: config.executionMode,
    }

    const updatedMessages = [...get().messages, userMsg, agentMsg]
    set({ messages: updatedMessages, isRunning: true, activeMessageId: agentMsgId })

    const script = buildScript(text, config)
    let iteration = 0
    let tokens = 0

    for (const scripted of script) {
      if (scripted.type === "thinking") iteration += 1
      await sleep(scripted.delay / speed)

      // Live tool execution integration
      if (config.executionMode === "live_tools" && scripted.type === "tool_call") {
        const liveRes = await executeLiveTool(scripted.toolName, scripted.args, config.customTools)
        const nextObsIndex = script.findIndex((s) => s.type === "observation" && "source" in s && s.source === scripted.toolName)
        if (nextObsIndex !== -1) {
          const obs = script[nextObsIndex] as { type: "observation"; summary: string; data: unknown }
          obs.summary = liveRes.summary
          obs.data = liveRes.data
        }
      }

      const step = realizeStep(scripted, iteration) as TraceStep
      set((s) => ({
        messages: s.messages.map((m) => (m.id === agentMsgId ? { ...m, trace: [...(m.trace ?? []), step], iterations: iteration } : m)),
      }))

      const workMs = scripted.type === "observation" ? 600 : scripted.type === "tool_call" ? 400 : 250
      await sleep(workMs / speed)

      const finishedAt = Date.now()
      tokens += scripted.type === "thinking" ? (scripted.tokensIn ?? 40) + (scripted.tokensOut ?? 60) : 30

      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === agentMsgId
            ? { ...m, trace: (m.trace ?? []).map((t) => (t.id === step.id ? { ...t, status: "completed", finishedAt, durationMs: finishedAt - step.startedAt } : t)), totalTokens: tokens }
            : m
        ),
      }))
    }

    set((s) => {
      const finalMsgs = s.messages.map((m) => (m.id === agentMsgId ? { ...m, status: "completed" as const, finishedAt: Date.now() } : m))
      const updatedSess = sessions.map((sess) =>
        sess.id === activeSessionId
          ? { ...sess, title: sess.title === "New Chat" || sess.title === "Initial Session" ? text.slice(0, 24) : sess.title, messages: finalMsgs, updatedAt: Date.now() }
          : sess
      )
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSess))
      return { isRunning: false, activeMessageId: null, messages: finalMsgs, sessions: updatedSess }
    })
  },
}))
