"use client"

import { create } from "zustand"
import type { AgentConfig, AgentMessage, ChatSession, CustomTool, LlmProvider, ModelOption, ProviderApiKey, TraceStep } from "@/lib/agent-types"
import { AVAILABLE_MODELS, DEFAULT_CONFIG } from "@/lib/agent-types"
import { exportTraceToMarkdown, exportTraceToJson, downloadFile } from "@/lib/trace-exporter"

const STORAGE_KEY = "agentic_chat_sessions_v2"
const CONFIG_KEY = "agentic_chat_config_v2"

interface AgentState {
  sessions: ChatSession[]
  activeSessionId: string
  messages: AgentMessage[]
  isRunning: boolean
  activeMessageId: string | null
  speed: number
  config: AgentConfig
  sidebarCollapsed: boolean
  models: ModelOption[]
  isLoadingModels: boolean
  isLiveModels: boolean
  hydrated: boolean

  // Actions
  hydrateFromStorage: () => void
  loadModels: (provider?: LlmProvider, baseUrl?: string, apiKey?: string) => Promise<void>
  sendUserMessage: (text: string) => Promise<void>
  setSpeed: (s: number) => void
  updateConfig: (partial: Partial<AgentConfig>) => void
  addApiKey: (key: string, label: string) => void
  removeApiKey: (id: string) => void
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

const initialSessionId = "sess_initial"
const initialWelcomeMessage: AgentMessage = {
  id: "welcome",
  role: "agent",
  status: "completed",
  query: "welcome",
  startedAt: 1700000000000,
  finishedAt: 1700000000000,
  iterations: 0,
  totalTokens: 0,
  modelId: DEFAULT_CONFIG.modelId,
  systemPrompt: DEFAULT_CONFIG.systemPrompt,
  provider: DEFAULT_CONFIG.provider,
  trace: [
    {
      id: "welcome_answer",
      kind: "answer",
      status: "completed",
      iteration: 1,
      startedAt: 1700000000000,
      finishedAt: 1700000000000,
      content:
        "👋 Welcome to the **Agentic ReAct Runtime**.\n\nConnected directly to real LLM providers (**Ollama Local**, **Ollama Cloud**, **OpenAI**, **Groq**, etc.) with live tool execution.\n\n- **Ollama Local**: Zero API key needed.\n- **Ollama Cloud & Cloud Providers**: Multiple API key management.\n- **Filtered Models**: Clean list of chat models with embedding models excluded.",
    },
  ],
}

const defaultSession: ChatSession = {
  id: initialSessionId,
  title: "Initial Session",
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  messages: [initialWelcomeMessage],
}

export const useAgentStore = create<AgentState>((set, get) => ({
  sessions: [defaultSession],
  activeSessionId: initialSessionId,
  messages: [initialWelcomeMessage],
  isRunning: false,
  activeMessageId: null,
  speed: 1,
  config: DEFAULT_CONFIG,
  sidebarCollapsed: false,
  models: AVAILABLE_MODELS.filter((m) => m.provider === DEFAULT_CONFIG.provider),
  isLoadingModels: false,
  isLiveModels: false,
  hydrated: false,

  hydrateFromStorage: () => {
    if (typeof window === "undefined" || get().hydrated) return
    try {
      const savedSessions = localStorage.getItem(STORAGE_KEY)
      const savedConfig = localStorage.getItem(CONFIG_KEY)
      const parsedConfig = savedConfig ? { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) } : DEFAULT_CONFIG
      const parsedSessions = savedSessions ? JSON.parse(savedSessions) : [defaultSession]
      const activeId = parsedSessions[0]?.id || initialSessionId
      const activeMsgs = parsedSessions[0]?.messages || [initialWelcomeMessage]

      set({
        sessions: parsedSessions,
        activeSessionId: activeId,
        messages: activeMsgs,
        config: parsedConfig,
        hydrated: true,
      })
      get().loadModels(parsedConfig.provider, parsedConfig.apiBaseUrl, parsedConfig.apiKey)
    } catch {
      set({ hydrated: true })
    }
  },

  loadModels: async (providerOverride, baseUrlOverride, apiKeyOverride) => {
    const provider = providerOverride || get().config.provider
    const apiBaseUrl = baseUrlOverride !== undefined ? baseUrlOverride : get().config.apiBaseUrl
    const apiKey = apiKeyOverride !== undefined ? apiKeyOverride : get().config.apiKey

    set({ isLoadingModels: true })
    try {
      const params = new URLSearchParams({ provider, apiBaseUrl, apiKey })
      const res = await fetch(`/api/models?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const fetchedList: ModelOption[] = data.models || []
        const currentModel = get().config.modelId
        const hasCurrent = fetchedList.some((m) => m.id === currentModel)
        const nextModel = hasCurrent ? currentModel : fetchedList[0]?.id || currentModel

        set({ models: fetchedList, isLiveModels: Boolean(data.isLive), isLoadingModels: false })
        if (nextModel !== currentModel) get().updateConfig({ modelId: nextModel })
        return
      }
    } catch {
      // Fallback
    }

    const fallback = AVAILABLE_MODELS.filter((m) => m.provider === provider)
    set({ models: fallback.length > 0 ? fallback : AVAILABLE_MODELS, isLoadingModels: false, isLiveModels: false })
  },

  setSpeed: (s) => set({ speed: s }),

  updateConfig: (partial) => {
    set((s) => {
      const nextConfig = { ...s.config, ...partial }
      if (typeof window !== "undefined") localStorage.setItem(CONFIG_KEY, JSON.stringify(nextConfig))
      return { config: nextConfig }
    })
    if (partial.provider || partial.apiBaseUrl !== undefined || partial.apiKey !== undefined) {
      get().loadModels(partial.provider, partial.apiBaseUrl, partial.apiKey)
    }
  },

  addApiKey: (key, label) => {
    const newKey: ProviderApiKey = { id: `key_${Date.now()}`, label: label || `Key (${get().config.provider})`, key, provider: get().config.provider, createdAt: Date.now() }
    const updated = [...(get().config.apiKeys || []), newKey]
    get().updateConfig({ apiKeys: updated, apiKey: key })
  },

  removeApiKey: (id) => {
    const updated = (get().config.apiKeys || []).filter((k) => k.id !== id)
    const activeKey = get().config.apiKey === id ? updated[0]?.key || "" : get().config.apiKey
    get().updateConfig({ apiKeys: updated, apiKey: activeKey })
  },

  toggleTool: (name) => {
    get().updateConfig({ enabledTools: { ...get().config.enabledTools, [name]: get().config.enabledTools[name] === false } })
  },

  saveCustomTool: (tool) => {
    const updated = [...(get().config.customTools || []).filter((t) => t.id !== tool.id), tool]
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
    get().loadModels(DEFAULT_CONFIG.provider, DEFAULT_CONFIG.apiBaseUrl, DEFAULT_CONFIG.apiKey)
  },

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  createNewSession: () => {
    const newId = `sess_${Date.now()}`
    const newSession: ChatSession = { id: newId, title: "New Chat", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }
    set((s) => {
      const sessions = [newSession, ...s.sessions]
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
      return { sessions, activeSessionId: newId, messages: [] }
    })
  },

  switchSession: (id) => {
    const session = get().sessions.find((s) => s.id === id)
    if (session) set({ activeSessionId: id, messages: session.messages })
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
    if (format === "md") downloadFile(`react-trace-${msg.id}.md`, exportTraceToMarkdown(msg), "text/markdown")
    else downloadFile(`react-trace-${msg.id}.json`, exportTraceToJson(msg), "application/json")
  },

  clear: () => {
    set((s) => {
      const updated = s.sessions.map((sess) => (sess.id === s.activeSessionId ? { ...sess, messages: [] } : sess))
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return { messages: [], isRunning: false, activeMessageId: null, sessions: updated }
    })
  },

  sendUserMessage: async (text) => {
    if (get().isRunning) return
    const { config, activeSessionId, sessions } = get()
    const userMsg: AgentMessage = { id: `u_${Date.now()}`, role: "user", content: text }
    const agentMsgId = `a_${Date.now()}`
    const agentMsg: AgentMessage = {
      id: agentMsgId, role: "agent", query: text, trace: [], status: "running", startedAt: Date.now(),
      iterations: 0, totalTokens: 0, modelId: config.modelId, systemPrompt: config.systemPrompt,
      temperature: config.temperature, maxIterations: config.maxIterations, provider: config.provider,
    }

    set({ messages: [...get().messages, userMsg, agentMsg], isRunning: true, activeMessageId: agentMsgId })

    try {
      const res = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, config, customTools: config.customTools }),
      })
      if (!res.ok || !res.body) throw new Error(`API error (${res.status}): ${await res.text()}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let currentIter = 1
      let tokens = 0

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data:")) continue
          const rawData = trimmed.slice(5).trim()
          if (rawData === "[DONE]") break

          try {
            const parsed = JSON.parse(rawData)
            const stepId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
            currentIter = parsed.iteration || currentIter
            tokens += (parsed.tokensIn || 0) + (parsed.tokensOut || 0) || 30

            const step: TraceStep = {
              ...parsed, id: stepId, status: "completed", iteration: currentIter,
              startedAt: Date.now(), finishedAt: Date.now(), durationMs: 400,
            }
            set((s) => ({
              messages: s.messages.map((m) => m.id === agentMsgId ? { ...m, trace: [...(m.trace ?? []), step], iterations: currentIter, totalTokens: tokens } : m),
            }))
          } catch {
            // Ignore parse errors on split packets
          }
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const errorStep: TraceStep = {
        id: `err_${Date.now()}`, kind: "answer", status: "error", iteration: 1, startedAt: Date.now(), finishedAt: Date.now(),
        content: `⚠️ **Connection Error:** ${errorMsg}\n\nEnsure provider **${config.provider}** is running.`,
      }
      set((s) => ({ messages: s.messages.map((m) => (m.id === agentMsgId ? { ...m, trace: [...(m.trace ?? []), errorStep] } : m)) }))
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
