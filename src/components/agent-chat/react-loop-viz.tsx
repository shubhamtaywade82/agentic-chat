"use client"

import { motion } from "framer-motion"
import { Brain, Wrench, Eye, Sparkles, RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TraceStep } from "@/lib/agent-types"

type Phase = "idle" | "reason" | "act" | "observe" | "done"

export function derivePhase(trace: TraceStep[] | undefined, running: boolean): Phase {
  if (!trace || trace.length === 0) return running ? "reason" : "idle"
  const last = trace[trace.length - 1]
  if (!running && last.kind === "answer") return "done"
  if (running) {
    switch (last.kind) {
      case "thinking":
      case "plan":
        return "reason"
      case "tool_call":
        return "act"
      case "observation":
        return "observe"
      case "answer":
        return "done"
    }
  }
  // not running, last wasn't answer → idle
  return "idle"
}

const PHASES: { key: Exclude<Phase, "idle" | "done">; label: string; icon: typeof Brain; color: string; text: string; glow: string }[] = [
  { key: "reason", label: "Reason", icon: Brain, color: "#10b981", text: "text-emerald-600 dark:text-emerald-400", glow: "shadow-emerald-500/40" },
  { key: "act", label: "Act", icon: Wrench, color: "#f59e0b", text: "text-amber-600 dark:text-amber-400", glow: "shadow-amber-500/40" },
  { key: "observe", label: "Observe", icon: Eye, color: "#14b8a6", text: "text-teal-600 dark:text-teal-400", glow: "shadow-teal-500/40" },
]

export function ReactLoopViz({
  phase,
  iteration,
  compact = false,
}: {
  phase: Phase
  iteration: number
  compact?: boolean
}) {
  const size = compact ? 120 : 180
  const center = size / 2
  const radius = compact ? 42 : 62
  const activeIndex = PHASES.findIndex((p) => p.key === phase)
  const isDone = phase === "done"
  const isIdle = phase === "idle"

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0">
          {/* connecting arcs */}
          {PHASES.map((p, i) => {
            const next = (i + 1) % PHASES.length
            const a1 = (i / PHASES.length) * Math.PI * 2 - Math.PI / 2
            const a2 = (next / PHASES.length) * Math.PI * 2 - Math.PI / 2
            const x1 = center + radius * Math.cos(a1)
            const y1 = center + radius * Math.sin(a1)
            const x2 = center + radius * Math.cos(a2)
            const y2 = center + radius * Math.sin(a2)
            const isActiveArc =
              !isIdle && !isDone && (activeIndex === i)
            return (
              <path
                key={p.key}
                d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
                fill="none"
                stroke={isActiveArc ? p.color : "currentColor"}
                strokeWidth={isActiveArc ? 2.5 : 1.5}
                strokeDasharray={isActiveArc ? "0" : "4 4"}
                className={isActiveArc ? "" : "text-border"}
                strokeLinecap="round"
              />
            )
          })}
        </svg>

        {/* phase nodes */}
        {PHASES.map((p, i) => {
          const angle = (i / PHASES.length) * Math.PI * 2 - Math.PI / 2
          const x = center + radius * Math.cos(angle) - 14
          const y = center + radius * Math.sin(angle) - 14
          const isActive = activeIndex === i && !isIdle && !isDone
          const Icon = p.icon
          return (
            <motion.div
              key={p.key}
              className={cn(
                "absolute flex h-7 w-7 items-center justify-center rounded-full border transition-colors duration-300",
                isActive ? "text-white" : cn("bg-background", p.text)
              )}
              style={{
                left: x,
                top: y,
                backgroundColor: isActive ? p.color : undefined,
                borderColor: isActive ? p.color : undefined,
              }}
              animate={{ scale: isActive ? 1.18 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Icon className="h-3.5 w-3.5" />
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 0 4px ${p.color}33` }}
                  animate={{ opacity: [0.6, 0.2, 0.6] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              )}
            </motion.div>
          )
        })}

        {/* center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isDone ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Sparkles className="h-4 w-4" />
            </motion.div>
          ) : isIdle ? (
            <RotateCw className="h-5 w-5 text-muted-foreground/40" />
          ) : (
            <>
              <span className="text-lg font-bold tabular-nums text-foreground">{iteration}</span>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                {iteration === 1 ? "iter" : "iters"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* legend / status text */}
      <div className="mt-2 flex items-center gap-1.5">
        {isIdle ? (
          <span className="text-[11px] text-muted-foreground">Idle</span>
        ) : isDone ? (
          <span className="text-[11px] font-medium text-foreground">Completed</span>
        ) : (
          <>
            <span className={cn("text-[11px] font-medium", PHASES[activeIndex]?.text)}>
              {PHASES[activeIndex]?.label}ing
            </span>
            <span className="text-[11px] text-muted-foreground">· iter {iteration}</span>
          </>
        )}
      </div>
    </div>
  )
}
