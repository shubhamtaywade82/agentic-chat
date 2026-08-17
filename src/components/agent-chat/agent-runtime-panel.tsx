"use client"

import { useAgentStore } from "@/store/agent-store"
import { ReactLoopViz, derivePhase } from "./react-loop-viz"
import { Activity, Coins, Brain, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AVAILABLE_TOOLS } from "@/lib/agent-types"
import { cn } from "@/lib/utils"

export function AgentRuntimePanel() {
  const { messages, isRunning, activeMessageId, config } = useAgentStore()

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
  const memoriesCount = (config.memories || []).filter((m) => m.enabled).length

  return (
    <div className="flex h-full flex-col bg-card/50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
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

      {/* Scroll Body */}
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

          {/* Memory & Tools Status */}
          <section className="rounded-xl border border-border bg-background/50 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Brain className="h-3 w-3 text-purple-500" />
                <span>Memory & Tools</span>
              </div>
              <div className="flex gap-1">
                <span className="font-mono text-[9px] text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                  {memoriesCount} memories
                </span>
                <span className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {enabledBuiltinCount + customCount} tools
                </span>
              </div>
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
        </div>
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
