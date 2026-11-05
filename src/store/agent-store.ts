"use client"

import { create } from "zustand"
import type { AgentConfig, AgentMessage, ChatSession, TraceStep } from "@/lib/agent-types"
import { DEFAULT_CONFIG } from "@/lib/agent-types"
import { applyWireEvent, finishMessage, patchInteraction, readWireEvents } from "@/lib/apply-wire-event"
import { exportTraceToMarkdown, exportTraceToJson, downloadFile } from "@/lib/trace-exporter"
import { generateSessionTitle } from "@/lib/session-utils"
import { migrateStoredConfig } from "@/lib/stored-config"
import type { NexumCapabilities } from "@/lib/nexum"

const STORAGE_KEY = "agentic_chat_sessions_v2"
const CONFIG_KEY = "agentic_chat_config_v2"
const DEFAULT_TITLES = new Set(["New Chat", "Initial Session"])

// Aborting the /api/agent fetch is how Stop works: the route sees the disconnect and cancels the Nexum run.
let activeAbort: AbortController | null = null

interface AgentState {
  sessions: ChatSession[]
  activeSessionId: string
  /** The open chat's messages; always the same list as that session's `messages`. */
  messages: AgentMessage[]
  isRunning: boolean
  activeMessageId: string | null
  /** The Nexum run the current turn is streaming; needed to answer its interactions. */
  activeRunId: string | null
  /** The chat the running turn belongs to — not necessarily the open one, since the user may switch away. */
  activeRunSessionId: string | null
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

function persist(sessions: ChatSession[]): void {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

/** Rewrites one chat; the visible message list follows when that chat is the open one. */
function withSession(
  s: AgentState,
  sessionId: string,
  update: (session: ChatSession) => ChatSession,
): Pick<AgentState, "sessions"> & Partial<Pick<AgentState, "messages">> {
  const sessions = s.sessions.map((sess) => (sess.id === sessionId ? update(sess) : sess))
  const updated = sessions.find((sess) => sess.id === sessionId)
  return s.activeSessionId === sessionId && updated ? { sessions, messages: updated.messages } : { sessions }
}

function withMessage(s: AgentState, sessionId: string, messageId: string, update: (m: AgentMessage) => AgentMessage) {
  return withSession(s, sessionId, (sess) => ({
    ...sess,
    messages: sess.messages.map((m) => (m.id === messageId ? update(m) : m)),
  }))
}

function endStepFor(err: unknown, stoppedByUser: boolean): TraceStep {
  const now = Date.now()
  const message = err instanceof Error ? err.message : String(err)
  return {
    id: `err_${now}`,
    kind: "answer",
    status: stoppedByUser ? "completed" : "error",
    iteration: 1,
    startedAt: now,
    finishedAt: now,
    content: stoppedByUser ? "⚠️ Run cancelled." : `⚠️ **Could not run this turn**: ${message}`,
  }
}

export const useAgentStore = create<AgentState>((set, get) => ({
  sessions: [defaultSession],
  activeSessionId: initialSessionId,
  messages: [initialWelcomeMessage],
  isRunning: false,
  activeMessageId: null,
  activeRunId: null,
  activeRunSessionId: null,
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

      const storedSessions: ChatSession[] = savedSessions ? JSON.parse(savedSessions) : [defaultSession]
      // A run cannot survive a page reload, so a stored "running" message is one that was cut off.
      const parsedSessions = storedSessions.map((sess) => ({
        ...sess,
        messages: sess.messages.map((m) => (m.status === "running" ? { ...m, status: "error" as const } : m)),
      }))
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
    const newId = `sess_${crypto.randomUUID()}`
    const newSession: ChatSession = { id: newId, title: "New Chat", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }
    set((s) => {
      const sessions = [newSession, ...s.sessions]
      persist(sessions)
      return { sessions, activeSessionId: newId, messages: [] }
    })
  },

  switchSession: (id) => {
    const session = get().sessions.find((s) => s.id === id)
    if (session) set({ activeSessionId: id, messages: session.messages })
  },

  deleteSession: (id) => {
    if (get().activeRunSessionId === id) get().stopRun()
    set((s) => {
      const remaining = s.sessions.filter((sess) => sess.id !== id)
      const nextSessions = remaining.length > 0 ? remaining : [{ id: `sess_${Date.now()}`, title: "Initial Session", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }]
      persist(nextSessions)
      if (id !== s.activeSessionId) return { sessions: nextSessions }
      return { sessions: nextSessions, activeSessionId: nextSessions[0].id, messages: nextSessions[0].messages }
    })
  },

  renameSession: (id, newTitle) => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    set((s) => {
      const updated = s.sessions.map((sess) => (sess.id === id ? { ...sess, title: trimmed, updatedAt: Date.now() } : sess))
      persist(updated)
      return { sessions: updated }
    })
  },

  exportTrace: (messageId, format) => {
    const msg = get().messages.find((m) => m.id === messageId)
    if (!msg) return
    if (format === "md") downloadFile(`react-trace-${msg.id}.md`, exportTraceToMarkdown(msg), "text/markdown")
    else downloadFile(`react-trace-${msg.id}.json`, exportTraceToJson(msg), "application/json")
  },

  // Starts the chat over: the Nexum session is dropped too, or the agent would still remember the cleared turns.
  clear: () => {
    if (get().activeRunSessionId === get().activeSessionId) get().stopRun()
    set((s) => {
      const next = withSession(s, s.activeSessionId, (sess) => ({ ...sess, title: "New Chat", messages: [], nexumSessionId: undefined }))
      persist(next.sessions)
      return next
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
    const { activeRunId, activeMessageId, activeRunSessionId, sessions } = get()
    if (!activeRunId || !activeMessageId || !activeRunSessionId) return
    const message = sessions.find((s) => s.id === activeRunSessionId)?.messages.find((m) => m.id === activeMessageId)
    const step = message?.trace?.find((t) => t.id === stepId)
    if (step?.kind !== "interaction") return

    const patch = (fields: Parameters<typeof patchInteraction>[2]) =>
      set((s) => withMessage(s, activeRunSessionId, activeMessageId, (m) => patchInteraction(m, (t) => t.id === stepId, fields)))
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
    const { config, activeSessionId: runSessionId, sessions } = get()
    const session = sessions.find((s) => s.id === runSessionId)
    const title = !session?.title || DEFAULT_TITLES.has(session.title) ? generateSessionTitle(text) : session.title
    const agentMsgId = `a_${Date.now()}`
    const userMsg: AgentMessage = { id: `u_${Date.now()}`, role: "user", content: text }
    const agentMsg: AgentMessage = {
      id: agentMsgId, role: "agent", query: text, trace: [], status: "running", startedAt: Date.now(), iterations: 0, totalTokens: 0,
    }

    set((s) => {
      const next = withSession(s, runSessionId, (sess) => ({ ...sess, title, messages: [...sess.messages, userMsg, agentMsg], updatedAt: Date.now() }))
      persist(next.sessions)
      return { ...next, isRunning: true, activeMessageId: agentMsgId, activeRunId: null, activeRunSessionId: runSessionId }
    })
    const abort = new AbortController()
    activeAbort = abort
    const update = (fn: (m: AgentMessage) => AgentMessage) => set((s) => withMessage(s, runSessionId, agentMsgId, fn))

    let endStep: TraceStep | undefined
    try {
      const res = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
        body: JSON.stringify({
          query: text,
          presentation: config.presentation,
          approvalMode: config.approvalMode,
          modelTier: config.modelTier,
          nexumSessionId: session?.nexumSessionId,
        }),
      })
      if (!res.ok || !res.body) throw new Error(`API error (${res.status}): ${await res.text()}`)

      // The route hands back the Nexum session this turn ran against; the next turn in this chat reuses it.
      const nexumSessionId = res.headers.get("X-Nexum-Session-Id") ?? undefined
      if (nexumSessionId) set((s) => withSession(s, runSessionId, (sess) => ({ ...sess, nexumSessionId })))

      for await (const event of readWireEvents(res.body)) {
        if (event.kind === "run") set({ activeRunId: event.runId as string })
        else update((m) => applyWireEvent(m, event))
      }
    } catch (err: unknown) {
      endStep = endStepFor(err, abort.signal.aborted)
    } finally {
      if (activeAbort === abort) activeAbort = null
    }

    set((s) => {
      const next = withMessage(s, runSessionId, agentMsgId, (m) => finishMessage(m, endStep))
      persist(next.sessions)
      return { ...next, isRunning: false, activeMessageId: null, activeRunId: null, activeRunSessionId: null }
    })
    // A failed turn is often an unreachable server: refresh the connection status the footer shows.
    const finished = get().sessions.find((s) => s.id === runSessionId)?.messages.find((m) => m.id === agentMsgId)
    if (finished?.status === "error") void get().loadCapabilities()
  },
}))
