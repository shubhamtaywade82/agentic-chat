"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Bot, Coins, Repeat, Clock, CheckCircle2, Loader2, Cpu,
  Terminal, ChevronRight, Thermometer, Download, Copy, Check
} from "lucide-react"
import type { AgentMessage } from "@/lib/agent-types"
import { AVAILABLE_MODELS } from "@/lib/agent-types"
import { TraceStepView } from "./trace-step"
import { useAgentStore } from "@/store/agent-store"
import { exportTraceToMarkdown, copyToClipboard } from "@/lib/trace-exporter"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AgentMessageView({ message }: { message: AgentMessage }) {
  const trace = message.trace ?? []
  const running = message.status === "running"
  const totalDuration = message.finishedAt && message.startedAt ? (message.finishedAt - message.startedAt) / 1000 : undefined
  const [systemOpen, setSystemOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { exportTrace } = useAgentStore()

  const model = AVAILABLE_MODELS.find((m) => m.id === message.modelId)
  const hasSystem = Boolean(message.systemPrompt)

  const handleCopyTrace = async () => {
    const md = exportTraceToMarkdown(message)
    const success = await copyToClipboard(md)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground", running && "ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background")}>
          <Bot className="h-4 w-4" />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {/* Header Row */}
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-foreground">Agent</span>
          <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            <Cpu className="h-2.5 w-2.5" />
            {model?.id ?? message.modelId ?? "react-loop"}
          </span>

          {message.temperature != null && (
            <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              <Thermometer className="h-2.5 w-2.5" />
              {message.temperature.toFixed(2)}
            </span>
          )}

          {running ? (
            <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> running
            </span>
          ) : message.status === "completed" ? (
            <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <CheckCircle2 className="h-2.5 w-2.5" /> done
            </span>
          ) : null}

          {/* Stats & Actions */}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
            {message.iterations != null && message.iterations > 0 && (
              <span className="hidden sm:flex items-center gap-0.5 font-mono">
                <Repeat className="h-2.5 w-2.5" /> {message.iterations} {message.iterations === 1 ? "iter" : "iters"}
              </span>
            )}
            {message.totalTokens != null && message.totalTokens > 0 && (
              <span className="hidden sm:flex items-center gap-0.5 font-mono">
                <Coins className="h-2.5 w-2.5" /> {message.totalTokens} tok
              </span>
            )}
            {totalDuration != null && (
              <span className="hidden sm:flex items-center gap-0.5 font-mono">
                <Clock className="h-2.5 w-2.5" /> {totalDuration.toFixed(1)}s
              </span>
            )}

            {/* Trace Export Dropdown */}
            {trace.length > 0 && !running && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={handleCopyTrace} title="Copy trace markdown">
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" title="Export trace">
                      <Download className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs">
                    <DropdownMenuItem onClick={() => exportTrace(message.id, "md")}>
                      Export as Markdown (.md)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportTrace(message.id, "json")}>
                      Export as JSON (.json)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        {/* System Prompt Collapsible */}
        {hasSystem && (
          <Collapsible open={systemOpen} onOpenChange={setSystemOpen} className="mb-2">
            <div className="overflow-hidden rounded-lg border border-dashed border-border bg-muted/30">
              <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/50">
                <Terminal className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">System prompt</span>
                <span className="truncate text-[10px] text-muted-foreground/70">
                  {message.systemPrompt!.split("\n")[0].slice(0, 60)}...
                </span>
                <ChevronRight className={cn("ml-auto h-3 w-3 text-muted-foreground transition-transform", systemOpen && "rotate-90")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border/60 px-2.5 py-2">
                  <pre className="scroll-thin max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {message.systemPrompt}
                  </pre>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Trace Timeline */}
        {trace.length > 0 ? (
          <div className="space-y-0">
            {trace.map((step, i) => (
              <TraceStepView key={step.id} step={step} index={i} isLast={i === trace.length - 1} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="shimmer-text">Initializing agent…</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
