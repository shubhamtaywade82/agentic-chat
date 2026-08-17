"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  ListChecks,
  Wrench,
  Eye,
  MessageSquareText,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
  Clock,
  Coins,
} from "lucide-react"
import type { TraceStep } from "@/lib/agent-types"
import { Markdown } from "./markdown"
import { cn } from "@/lib/utils"
import { useState } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const KIND_META = {
  thinking: {
    label: "Thinking",
    icon: Brain,
    accent: "emerald",
    ring: "ring-emerald-500/20",
    bg: "bg-emerald-500/[0.04]",
    border: "border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  plan: {
    label: "Plan",
    icon: ListChecks,
    accent: "fuchsia",
    ring: "ring-fuchsia-500/20",
    bg: "bg-fuchsia-500/[0.04]",
    border: "border-fuchsia-500/20",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    dot: "bg-fuchsia-500",
  },
  tool_call: {
    label: "Tool Call",
    icon: Wrench,
    accent: "amber",
    ring: "ring-amber-500/20",
    bg: "bg-amber-500/[0.04]",
    border: "border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  observation: {
    label: "Observation",
    icon: Eye,
    accent: "teal",
    ring: "ring-teal-500/20",
    bg: "bg-teal-500/[0.04]",
    border: "border-teal-500/20",
    text: "text-teal-600 dark:text-teal-400",
    dot: "bg-teal-500",
  },
  answer: {
    label: "Final Answer",
    icon: MessageSquareText,
    accent: "primary",
    ring: "ring-border",
    bg: "bg-card",
    border: "border-border",
    text: "text-foreground",
    dot: "bg-primary",
  },
} as const

export function TraceStepView({ step, isLast, index }: { step: TraceStep; isLast: boolean; index: number }) {
  const meta = KIND_META[step.kind]
  const Icon = meta.icon
  const running = step.status === "running"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative pl-8"
    >
      {/* timeline rail + node */}
      <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center">
        {!isLast && <div className="absolute top-6 bottom-0 w-px bg-border" />}
        <div
          className={cn(
            "relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background",
            meta.border,
            running && "pulse-dot"
          )}
        >
          {running ? (
            <Loader2 className={cn("h-3 w-3 animate-spin", meta.text)} />
          ) : (
            <Icon className={cn("h-3 w-3", meta.text)} />
          )}
        </div>
      </div>

      <div className={cn("pb-4", isLast && "pb-0")}>
        <StepHeader step={step} meta={meta} index={index} />
        <div className="mt-1.5">
          <StepBody step={step} meta={meta} />
        </div>
      </div>
    </motion.div>
  )
}

function StepHeader({
  step,
  meta,
  index,
}: {
  step: TraceStep
  meta: (typeof KIND_META)[keyof typeof KIND_META]
  index: number
}) {
  const running = step.status === "running"
  const title = (() => {
    switch (step.kind) {
      case "thinking":
        return step.title
      case "plan":
        return "Decomposing the task"
      case "tool_call":
        return step.toolName
      case "observation":
        return `Observation from ${step.source}`
      case "answer":
        return "Answer"
    }
  })()

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={cn("font-mono text-[11px] font-medium uppercase tracking-wide", meta.text)}>
        {meta.label}
      </span>
      <span className="text-[11px] text-muted-foreground">·</span>
      <span className="text-sm font-medium text-foreground">{title}</span>
      {step.kind === "tool_call" && (
        <span className="text-[11px] text-muted-foreground truncate max-w-[280px]">
          — {step.description}
        </span>
      )}
      <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
        {step.iteration > 1 && <span className="rounded bg-muted px-1.5 py-0.5 font-mono">iter {step.iteration}</span>}
        {step.durationMs != null && (
          <span className="flex items-center gap-0.5 font-mono">
            <Clock className="h-2.5 w-2.5" />
            {(step.durationMs / 1000).toFixed(1)}s
          </span>
        )}
        {step.kind === "thinking" && (step.tokensIn || step.tokensOut) && (
          <span className="flex items-center gap-0.5 font-mono">
            <Coins className="h-2.5 w-2.5" />
            {step.tokensIn ?? 0}↑ {step.tokensOut ?? 0}↓
          </span>
        )}
        {running && <span className="shimmer-text font-medium">working…</span>}
      </span>
    </div>
  )
}

function StepBody({
  step,
  meta,
}: {
  step: TraceStep
  meta: (typeof KIND_META)[keyof typeof KIND_META]
}) {
  switch (step.kind) {
    case "thinking":
      return (
        <div className={cn("rounded-lg border p-3", meta.border, meta.bg)}>
          <Markdown content={step.reasoning} />
        </div>
      )
    case "plan":
      return <PlanBody step={step} meta={KIND_META.plan} />
    case "tool_call":
      return <ToolCallBody step={step} meta={KIND_META.tool_call} />
    case "observation":
      return <ObservationBody step={step} meta={KIND_META.observation} />
    case "answer":
      return (
        <div className={cn("rounded-xl border p-4 shadow-sm", meta.border, meta.bg)}>
          <Markdown content={step.content} />
          {step.status === "running" && (
            <span className="blink-cursor ml-0.5 inline-block h-4 w-1.5 -mb-0.5 bg-foreground align-middle" />
          )}
        </div>
      )
  }
}

function PlanBody({
  step,
  meta,
}: {
  step: Extract<TraceStep, { kind: "plan" }>
  meta: (typeof KIND_META)["plan"]
}) {
  const completed = step.steps.filter((s) => s.done).length
  return (
    <div className={cn("rounded-lg border p-3", meta.border, meta.bg)}>
      <p className="mb-2 text-sm text-foreground">
        <span className="text-muted-foreground">Goal: </span>
        <span className="font-medium">{step.goal}</span>
      </p>
      <ol className="space-y-1.5">
        {step.steps.map((s, i) => {
          // simulate progressive completion based on step status
          const done = step.status === "completed" || i < completed
          return (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]",
                  done ? cn(meta.border, meta.bg, meta.text) : "border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              <span className={cn(done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                {s.text}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ToolCallBody({
  step,
  meta,
}: {
  step: Extract<TraceStep, { kind: "tool_call" }>
  meta: (typeof KIND_META)["tool_call"]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn("rounded-lg border overflow-hidden", meta.border, meta.bg)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 px-3 py-2">
          <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium", meta.text, "bg-amber-500/10")}>
            {step.toolName}()
          </span>
          <span className="text-xs text-muted-foreground truncate">{step.description}</span>
          <CollapsibleTrigger asChild>
            <button className="ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
              <span>{open ? "hide" : "args"}</span>
              <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="border-t border-border/60 px-3 py-2">
            <JsonBlock label="arguments" data={step.args} />
          </div>
        </CollapsibleContent>
      </Collapsible>
      {step.status === "running" && (
        <div className="flex items-center gap-2 border-t border-border/60 bg-amber-500/[0.06] px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Executing tool…
        </div>
      )}
      {step.status === "error" && (
        <div className="flex items-center gap-2 border-t border-destructive/30 bg-destructive/5 px-3 py-1.5 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" />
          {step.error ?? "Tool call failed"}
        </div>
      )}
    </div>
  )
}

function ObservationBody({
  step,
  meta,
}: {
  step: Extract<TraceStep, { kind: "observation" }>
  meta: (typeof KIND_META)["observation"]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn("rounded-lg border overflow-hidden", meta.border, meta.bg)}>
      <div className="flex items-center gap-2 px-3 py-2">
        <Eye className={cn("h-3.5 w-3.5", meta.text)} />
        <span className="text-sm font-medium">{step.summary}</span>
        {step.status === "running" && (
          <Loader2 className={cn("h-3 w-3 animate-spin", meta.text)} />
        )}
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        {open ? "hide" : "view"} raw output
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 px-3 py-2">
              <JsonBlock label="data" data={step.data} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function JsonBlock({ label, data }: { label: string; data: unknown }) {
  return (
    <div className="rounded-md bg-[#282c34] text-zinc-200">
      <div className="border-b border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <pre className="scroll-thin max-h-64 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
{typeof data === "string" ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
