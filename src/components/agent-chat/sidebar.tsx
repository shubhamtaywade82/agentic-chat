"use client"

import { useAgentStore } from "@/store/agent-store"
import { ReactLoopViz, derivePhase } from "./react-loop-viz"
import { AgentConfigPanel } from "./agent-config"
import { Activity, Coins, MessageSquare, PanelLeftClose, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { messages, isRunning, activeMessageId, toggleSidebar } = useAgentStore()
  const activeMsg =
    messages.find((m) => m.id === activeMessageId) ??
    (isRunning ? undefined : [...messages].reverse().find((m) => m.role === "agent"))
  const phase = derivePhase(activeMsg?.trace, isRunning)
  const iteration = activeMsg?.iterations ?? 0

  const stats = {
    messages: messages.filter((m) => m.role === "user").length,
    tokens: messages.reduce((sum, m) => sum + (m.totalTokens ?? 0), 0),
    iters: messages.reduce((sum, m) => sum + (m.iterations ?? 0), 0),
  }

  return (
    <div className="flex h-full flex-col bg-card/50">
      {/* header — stays fixed */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">Agent Runtime</h2>
            <p className="text-[10px] text-muted-foreground">ReAct · v1.0</p>
          </div>
        </div>
        {/* mobile close (Sheet) */}
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
        {/* desktop collapse */}
        {!onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-7 w-7 lg:flex"
            onClick={toggleSidebar}
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* scrollable body — native overflow is more reliable than Radix
          ScrollArea inside a flex column (the viewport needs a hard height
          constraint that flex-1 doesn't always provide) */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-3">
          {/* live loop viz */}
          <section>
            <SectionLabel>ReAct Loop</SectionLabel>
            <div className="flex justify-center rounded-xl border border-border bg-background/50 p-3">
              <ReactLoopViz phase={phase} iteration={iteration} />
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {isRunning
                ? "Agent is cycling through reasoning, action, and observation."
                : phase === "done"
                ? "Agent reached a final answer."
                : "Send a message to start the loop."}
            </p>
          </section>

          {/* stats */}
          <section>
            <SectionLabel>Session</SectionLabel>
            <div className="grid grid-cols-3 gap-1.5">
              <StatCard icon={MessageSquare} value={stats.messages} label="msgs" />
              <StatCard icon={Coins} value={stats.tokens} label="tokens" />
              <StatCard icon={Activity} value={stats.iters} label="iters" />
            </div>
          </section>

          {/* config + tools */}
          <AgentConfigPanel />
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Activity
  value: number
  label: string
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-2 text-center">
      <Icon className="mx-auto mb-0.5 h-3 w-3 text-muted-foreground" />
      <div className="text-sm font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}
