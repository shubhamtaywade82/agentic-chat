"use client"

import { create } from "zustand"
import type { AgentConfig, AgentMessage, ChatSession, InteractionStep, TraceStep } from "@/lib/agent-types"
import { DEFAULT_CONFIG } from "@/lib/agent-types"
import { exportTraceToMarkdown, exportTraceToJson, downloadFile } from "@/lib/trace-exporter"
import { generateSessionTitle } from "@/lib/session-utils"
import { migrateStoredConfig } from "@/lib/stored-config"
import type { NexumCapabilities } from "@/lib/nexum"

const STORAGE_KEY = "agentic_chat_sessions_v2"
const CONFIG_KEY = "agentic_chat_config_v2"

// Aborting the /api/agent fetch is how Stop works: the route sees the disconnect and cancels the Nexum run.
let activeAbort: AbortController | null = null

function patchInteractionStep(
  messages: AgentMessage[],
  messageId: string,
  match: (step: InteractionStep) => boolean,
  patch: Partial<InteractionStep>,
): AgentMessage[] {
  return messages.map((m) =>
    m.id !== messageId
      ? m
      : { ...m, trace: m.trace?.map((t) => (t.kind === "interaction" && match(t) ? { ...t, ...patch } : t)) },
  )
}

/** Interactions still pending when a run ends can no longer be answered. */
function closePendingInteractions(messages: AgentMessage[], messageId: string): AgentMessage[] {
  return patchInteractionStep(messages, messageId, (t) => t.status === "pending", {
    status: "completed",
    finishedAt: Date.now(),
  })
}

interface AgentState {
  sessions: ChatSession[]
  activeSessionId: string
  messages: AgentMessage[]
  isRunning: boolean
  activeMessageId: string | null
  /** The Nexum run the current turn is streaming; needed to answer its interactions. */
  activeRunId: string | null
  /** What the Nexum server reports it can do; null until loaded or while it is unreachable. */
  capabilities: NexumCapabilities | null
  capabilitiesError: string | null
  config: AgentConfig
  sidebarCollapsed: boolean
  rightPanelCollapsed: boolean
  hydrated: boolean

  // Actions
  hydrateFromStorage: () => void
  sendUserMessage: (text: string) => Promise<void>
  stopRun: () => void
  loadCapabilities: () => Promise<void>
  resolveInteraction: (stepId: string, resolution: { approved?: boolean; selectedId?: string }) => Promise<void>
  updateConfig: (partial: Partial<AgentConfig>) => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  toggleRightPanel: () => void
  createNewSession: () => void
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  renameSession: (id: string, newTitle: string) => void
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
  trace: [
    {
      id: "welcome_answer",
      kind: "answer",
      status: "completed",
      iteration: 1,
      startedAt: 1700000000000,
      finishedAt: 1700000000000,
      content:
        "👋 Welcome. This chat runs on a **Nexum** agent: plans, tool calls, approvals and results appear here as they happen, and anything that needs your go-ahead pauses the run until you answer.\n\nThe runtime panel lists the tools, skills and models the connected server offers.",
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
  activeRunId: null,
  capabilities: null,
  capabilitiesError: null,
  config: DEFAULT_CONFIG,
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
  hydrated: false,

  hydrateFromStorage: () => {
    if (typeof window === "undefined" || get().hydrated) return
    try {
      const savedSessions = localStorage.getItem(STORAGE_KEY)
      const { config, rewrite } = migrateStoredConfig(localStorage.getItem(CONFIG_KEY))
      if (rewrite) localStorage.setItem(CONFIG_KEY, JSON.stringify(config))

      const parsedSessions = savedSessions ? JSON.parse(savedSessions) : [defaultSession]
      const activeId = parsedSessions[0]?.id || initialSessionId
      const activeMsgs = parsedSessions[0]?.messages || [initialWelcomeMessage]

      set({ sessions: parsedSessions, activeSessionId: activeId, messages: activeMsgs, config, hydrated: true })
    } catch {
      set({ hydrated: true })
    }
  },

  updateConfig: (partial) => {
    set((s) => {
      const nextConfig = { ...s.config, ...partial }
      if (typeof window !== "undefined") localStorage.setItem(CONFIG_KEY, JSON.stringify(nextConfig))
      return { config: nextConfig }
    })
  },

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),

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

  renameSession: (id, newTitle) => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    set((s) => {
      const updated = s.sessions.map((sess) => (sess.id === id ? { ...sess, title: trimmed, updatedAt: Date.now() } : sess))
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return { sessions: updated }
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

  stopRun: () => activeAbort?.abort(),

  loadCapabilities: async () => {
    try {
      const res = await fetch("/api/capabilities")
      const json = (await res.json()) as { ok: boolean; capabilities?: NexumCapabilities; error?: string }
      if (!json.ok || !json.capabilities) throw new Error(json.error ?? `Request failed (${res.status})`)
      set({ capabilities: json.capabilities, capabilitiesError: null })
    } catch (err: unknown) {
      set({ capabilities: null, capabilitiesError: err instanceof Error ? err.message : String(err) })
    }
  },

  resolveInteraction: async (stepId, resolution) => {
    const { activeRunId, activeMessageId, messages } = get()
    const step = messages.find((m) => m.id === activeMessageId)?.trace?.find((t) => t.id === stepId)
    if (!activeRunId || !activeMessageId || step?.kind !== "interaction") return

    const patch = (fields: Partial<InteractionStep>) =>
      set((s) => ({ messages: patchInteractionStep(s.messages, activeMessageId, (t) => t.id === stepId, fields) }))
    patch({ status: "running", error: undefined })
    try {
      const res = await fetch("/api/agent/interactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: activeRunId, interactionId: step.interactionId, ...resolution }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      // On success the stream's *.resolved event completes the step; on failure let the user retry.
      if (!json.ok) patch({ status: "pending", error: json.error ?? `Request failed (${res.status})` })
    } catch (err: unknown) {
      patch({ status: "pending", error: err instanceof Error ? err.message : String(err) })
    }
  },

  sendUserMessage: async (text) => {
    if (get().isRunning) return
    const { config, activeSessionId, sessions } = get()
    const currentSession = sessions.find((s) => s.id === activeSessionId)
    const isDefaultTitle = !currentSession?.title || currentSession.title === "New Chat" || currentSession.title === "Initial Session" || currentSession.title.startsWith("sess_")
    const sessionTitle = isDefaultTitle ? generateSessionTitle(text) : currentSession.title

    const userMsg: AgentMessage = { id: `u_${Date.now()}`, role: "user", content: text }
    const agentMsgId = `a_${Date.now()}`
    const agentMsg: AgentMessage = {
      id: agentMsgId, role: "agent", query: text, trace: [], status: "running", startedAt: Date.now(),
      iterations: 0, totalTokens: 0,
    }

    const initialMsgs = [...get().messages, userMsg, agentMsg]
    const initialSessions = sessions.map((sess) => (sess.id === activeSessionId ? { ...sess, title: sessionTitle, messages: initialMsgs, updatedAt: Date.now() } : sess))
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(initialSessions))

    set({ messages: initialMsgs, sessions: initialSessions, isRunning: true, activeMessageId: agentMsgId, activeRunId: null })
    const abort = new AbortController()
    activeAbort = abort

    let currentIter = 1
    let tokens = 0

    try {
      const res = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
        body: JSON.stringify({ query: text, presentation: config.presentation, nexumSessionId: currentSession?.nexumSessionId }),
      })
      if (!res.ok || !res.body) throw new Error(`API error (${res.status}): ${await res.text()}`)

      // When routed through Nexum (the default; not in legacy mode), the server hands
      // back the session it ran this turn against — persist it so the next
      // turn in this chat reuses the same Nexum session instead of minting
      // a fresh one (route.ts's X-Nexum-Session-Id header).
      const nexumSessionIdFromResponse = res.headers.get("X-Nexum-Session-Id")
      if (nexumSessionIdFromResponse && nexumSessionIdFromResponse !== currentSession?.nexumSessionId) {
        set((s) => {
          const updated = s.sessions.map((sess) =>
            sess.id === activeSessionId ? { ...sess, nexumSessionId: nexumSessionIdFromResponse } : sess,
          )
          if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          return { sessions: updated }
        })
      }

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
            if (parsed.kind === "run") {
              set({ activeRunId: parsed.runId })
              continue
            }
            if (parsed.kind === "interaction_resolved") {
              set((s) => ({
                messages: patchInteractionStep(s.messages, agentMsgId, (t) => t.interactionId === parsed.interactionId, {
                  status: "completed",
                  finishedAt: Date.now(),
                  resolution: parsed.resolution,
                  error: undefined,
                }),
              }))
              continue
            }
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
        const msgs = closePendingInteractions(s.messages, agentMsgId).map((m) => (m.id === agentMsgId ? { ...m, status: "completed" as const, finishedAt: Date.now() } : m))
        const updated = s.sessions.map((sess) => (sess.id === s.activeSessionId ? { ...sess, title: sessionTitle, messages: msgs, updatedAt: Date.now() } : sess))
        if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        return { messages: msgs, isRunning: false, activeMessageId: null, activeRunId: null, sessions: updated }
      })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const stoppedByUser = abort.signal.aborted
      set((s) => {
        const msgs = closePendingInteractions(s.messages, agentMsgId).map((m) => {
          if (m.id !== agentMsgId) return m
          const endStep: TraceStep = {
            id: `err_${Date.now()}`,
            kind: "answer",
            status: stoppedByUser ? "completed" : "error",
            iteration: currentIter,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            content: stoppedByUser ? "⚠️ Run cancelled." : `⚠️ **Agent Execution Error**: ${errorMsg}`,
          }
          return { ...m, trace: [...(m.trace || []), endStep], status: stoppedByUser ? ("completed" as const) : ("error" as const), finishedAt: Date.now() }
        })
        return { messages: msgs, isRunning: false, activeMessageId: null, activeRunId: null }
      })
    } finally {
      if (activeAbort === abort) activeAbort = null
    }
  },
}))
