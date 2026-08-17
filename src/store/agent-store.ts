"use client"

import { create } from "zustand"
import type {
  AgentConfig, AgentMemoryItem, AgentMessage, ChatSession, CustomTool,
  LlmProvider, ModelOption, ProviderApiKey, TraceStep
} from "@/lib/agent-types"
import { AVAILABLE_MODELS, DEFAULT_CONFIG } from "@/lib/agent-types"
import { exportTraceToMarkdown, exportTraceToJson, downloadFile } from "@/lib/trace-exporter"
import { parseLearnCommand } from "@/lib/memory-engine"

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
  addMemory: (item: Omit<AgentMemoryItem, "id" | "createdAt" | "updatedAt">) => void
  updateMemory: (id: string, partial: Partial<AgentMemoryItem>) => void
  deleteMemory: (id: string) => void
  toggleMemory: (id: string) => void
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
        "👋 Welcome to the **Agentic ReAct Runtime**.\n\nConnected directly to real LLM providers (**Ollama Local**, **Ollama Cloud**, **OpenAI**, **Groq**, etc.) with live tool execution.\n\n- **Ollama Local**: Zero API key needed.\n- **Ollama Cloud & Cloud Providers**: Multiple API key management.\n- **Live WebSocket Streams**: Real-time tick streams for Binance USD-M & Indian markets.\n- **Long-Term Memory & Learning**: Remembers trading facts, user preferences, and learned corrections (`/learn`).",
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

  addMemory: (item) => {
    const newMem: AgentMemoryItem = {
      id: `mem_${Date.now()}`,
      category: item.category,
      title: item.title,
      content: item.content,
      source: item.source || "user",
      enabled: item.enabled !== false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [newMem, ...(get().config.memories || [])]
    get().updateConfig({ memories: updated })
  },

  updateMemory: (id, partial) => {
    const updated = (get().config.memories || []).map((m) =>
      m.id === id ? { ...m, ...partial, updatedAt: Date.now() } : m
    )
    get().updateConfig({ memories: updated })
  },

  deleteMemory: (id) => {
    const updated = (get().config.memories || []).filter((m) => m.id !== id)
    get().updateConfig({ memories: updated })
  },

  toggleMemory: (id) => {
    const updated = (get().config.memories || []).map((m) =>
      m.id === id ? { ...m, enabled: !m.enabled, updatedAt: Date.now() } : m
    )
    get().updateConfig({ memories: updated })
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

    // Handle /learn command directly
    const learnInfo = parseLearnCommand(text)
    if (learnInfo) {
      get().addMemory({
        category: learnInfo.category,
        title: learnInfo.title,
        content: learnInfo.content,
        source: "user",
        enabled: true,
      })
      const userMsg: AgentMessage = { id: `u_${Date.now()}`, role: "user", content: text }
      const agentMsg: AgentMessage = {
        id: `a_${Date.now()}`,
        role: "agent",
        query: text,
        trace: [
          {
            id: `step_${Date.now()}`,
            kind: "answer",
            status: "completed",
            iteration: 1,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            content: `🧠 **Learned & Saved to Agent Memory!**\n\n- **Category**: \`${learnInfo.category}\`\n- **Title**: ${learnInfo.title}\n- **Pattern**: "${learnInfo.content}"\n\nI will remember this context and automatically apply it in all future reasoning turns.`,
          },
        ],
        status: "completed",
        startedAt: Date.now(),
        finishedAt: Date.now(),
        iterations: 1,
        totalTokens: 0,
      }
      const updatedMsgs = [...get().messages, userMsg, agentMsg]
      const updatedSessions = sessions.map((s) => (s.id === activeSessionId ? { ...s, messages: updatedMsgs, updatedAt: Date.now() } : s))
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions))
      set({ messages: updatedMsgs, sessions: updatedSessions })
      return
    }

    const userMsg: AgentMessage = { id: `u_${Date.now()}`, role: "user", content: text }
    const agentMsgId = `a_${Date.now()}`
    const agentMsg: AgentMessage = {
      id: agentMsgId, role: "agent", query: text, trace: [], status: "running", startedAt: Date.now(),
      iterations: 0, totalTokens: 0, modelId: config.modelId, systemPrompt: config.systemPrompt,
      temperature: config.temperature, maxIterations: config.maxIterations, provider: config.provider,
    }

    const history = get().messages
      .filter((m) => m.id !== userMsg.id && m.id !== agentMsgId)
      .map((m) => {
        if (m.role === "user") {
          return { role: "user" as const, content: m.content || "" }
        }
        const answer = m.trace?.find((t) => t.kind === "answer")?.content || m.content || ""
        return { role: "assistant" as const, content: answer }
      })
      .filter((m) => m.content.trim().length > 0)
      .slice(-10)

    set({ messages: [...get().messages, userMsg, agentMsg], isRunning: true, activeMessageId: agentMsgId })

    let currentIter = 1
    let tokens = 0

    try {
      const res = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, history, config, customTools: config.customTools }),
      })
      if (!res.ok || !res.body) throw new Error(`API error (${res.status}): ${await res.text()}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

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
            currentIter = parsed.iteration || currentIter
            tokens += (parsed.tokensIn || 0) + (parsed.tokensOut || 0)

            set((s) => {
              const msgs = s.messages.map((m) => {
                if (m.id !== agentMsgId) return m
                const stepId = `step_${m.trace?.length || 0}_${Date.now()}`
                const newStep: TraceStep = {
                  id: stepId,
                  kind: parsed.kind,
                  status: "completed",
                  iteration: parsed.iteration || currentIter,
                  startedAt: Date.now(),
                  finishedAt: Date.now(),
                  ...parsed,
                }
                const nextTrace = [...(m.trace || []), newStep]
                return {
                  ...m,
                  trace: nextTrace,
                  iterations: currentIter,
                  totalTokens: tokens,
                }
              })
              return { messages: msgs }
            })
          } catch {
            // Ignore parse errors on chunks
          }
        }
      }

      set((s) => {
        const msgs = s.messages.map((m) => (m.id === agentMsgId ? { ...m, status: "completed" as const, finishedAt: Date.now() } : m))
        const updated = s.sessions.map((sess) => (sess.id === s.activeSessionId ? { ...sess, messages: msgs, updatedAt: Date.now() } : sess))
        if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        return { messages: msgs, isRunning: false, activeMessageId: null, sessions: updated }
      })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      set((s) => {
        const msgs = s.messages.map((m) => {
          if (m.id !== agentMsgId) return m
          const errStep: TraceStep = {
            id: `err_${Date.now()}`,
            kind: "answer",
            status: "error",
            iteration: currentIter,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            content: `⚠️ **Agent Execution Error**: ${errorMsg}`,
          }
          return { ...m, trace: [...(m.trace || []), errStep], status: "error" as const, finishedAt: Date.now() }
        })
        return { messages: msgs, isRunning: false, activeMessageId: null }
      })
    }
  },
}))
