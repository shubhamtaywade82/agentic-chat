"use client"

import { useAgentStore } from "@/store/agent-store"
import { ReactLoopViz, derivePhase } from "./react-loop-viz"
import { AgentConfigDialog } from "./agent-config-dialog"
import { Activity, Coins, MessageSquare, PanelLeftClose, Plus, Trash2, X, Sliders, Wrench, Zap, Sparkles, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AVAILABLE_TOOLS } from "@/lib/agent-types"
import { cn } from "@/lib/utils"

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { messages, isRunning, activeMessageId, toggleSidebar, sessions, activeSessionId, createNewSession, switchSession, deleteSession, config } = useAgentStore()
  const activeMsg = messages.find((m) => m.id === activeMessageId) ?? (isRunning ? undefined : [...messages].reverse().find((m) => m.role === "agent"))
  const phase = derivePhase(activeMsg?.trace, isRunning)
  const iteration = activeMsg?.iterations ?? 0

  const stats = {
    messages: messages.filter((m) => m.role === "user").length,
    tokens: messages.reduce((sum, m) => sum + (m.totalTokens ?? 0), 0),
    iters: messages.reduce((sum, m) => sum + (m.iterations ?? 0), 0),
  }

  const enabledBuiltinCount = Object.values(config.enabledTools).filter(Boolean).length
  const customCount = (config.customTools || []).filter((t) => t.enabled).length

  return (
    <div className="flex h-full flex-col bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">Agent Runtime</h2>
            <p className="text-[10px] text-muted-foreground font-mono">
              {config.provider.replace(/_/g, " ")} · {config.modelId}
            </p>
          </div>
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={onClose}><X className="h-4 w-4" /></Button>
        ) : (
          <Button variant="ghost" size="icon" className="hidden h-7 w-7 lg:flex" onClick={toggleSidebar} title="Collapse sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Visualizer Scroll Body */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-3">
          {/* Live ReAct Loop Viz */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <SectionLabel>ReAct Loop Visualizer</SectionLabel>
              <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                {isRunning ? "cycling" : "standby"}
              </Badge>
            </div>
            <div className="flex justify-center rounded-xl border border-border bg-background/60 p-3 shadow-inner">
              <ReactLoopViz phase={phase} iteration={iteration} />
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {isRunning
                ? "Agent is iterating through Reason → Act → Observe cycles."
                : phase === "done"
                ? "Agent completed ReAct cycle with a final answer."
                : "Awaiting next prompt to initiate loop."}
            </p>
          </section>

          {/* Session Telemetry */}
          <section>
            <SectionLabel>Session Telemetry</SectionLabel>
            <div className="grid grid-cols-3 gap-1.5">
              <StatCard icon={MessageSquare} value={stats.messages} label="msgs" />
              <StatCard icon={Coins} value={stats.tokens} label="tokens" />
              <StatCard icon={Activity} value={stats.iters} label="iters" />
            </div>
          </section>

          {/* Active Tools Glance */}
          <section className="rounded-xl border border-border bg-background/50 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Wrench className="h-3 w-3" />
                <span>Active Tools</span>
              </div>
              <span className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {enabledBuiltinCount + customCount} ready
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {AVAILABLE_TOOLS.map((t) => {
                const enabled = config.enabledTools[t.name] !== false
                return (
                  <span
                    key={t.name}
                    className={cn(
                      "px-1.5 py-0.5 rounded font-mono text-[9px] transition",
                      enabled ? "bg-muted text-foreground border border-border/60" : "bg-muted/30 text-muted-foreground/40 line-through"
                    )}
                  >
                    {t.name}
                  </span>
                )
              })}
            </div>
          </section>

          {/* Chat Sessions Navigator */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <SectionLabel>Chat Sessions</SectionLabel>
              <Button variant="ghost" size="sm" onClick={createNewSession} className="h-5 gap-1 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                <Plus className="h-2.5 w-2.5" /> New
              </Button>
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border/70 bg-background/50 p-1.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs transition",
                    s.id === activeSessionId ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span className="truncate max-w-[190px]">{s.title}</span>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition p-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Sidebar Footer with Backdrop Configuration Button */}
      <div className="p-3 border-t border-border bg-background/40">
        <AgentConfigDialog
          trigger={
            <Button variant="outline" size="sm" className="w-full justify-center gap-1.5 text-xs h-8 bg-background shadow-xs hover:bg-muted">
              <Sliders className="h-3.5 w-3.5 text-emerald-500" />
              <span>Configure Providers & Loop</span>
            </Button>
          }
        />
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
}

function StatCard({ icon: Icon, value, label }: { icon: typeof Activity; value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-2 text-center">
      <Icon className="mx-auto mb-0.5 h-3 w-3 text-muted-foreground" />
      <div className="text-sm font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}
