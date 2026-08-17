"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  Settings2,
  RotateCcw,
  Thermometer,
  Repeat,
  Coins,
  Cpu,
  Terminal,
  Search,
  Calculator,
  FileText,
  CloudSun,
  Database,
  Image as ImageIcon,
  Wrench,
} from "lucide-react"
import { useAgentStore } from "@/store/agent-store"
import { AVAILABLE_MODELS, AVAILABLE_TOOLS, DEFAULT_CONFIG } from "@/lib/agent-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

const TOOL_ICONS: Record<string, typeof Wrench> = {
  search: Search,
  calculator: Calculator,
  terminal: Terminal,
  "file-text": FileText,
  "cloud-sun": CloudSun,
  database: Database,
  image: ImageIcon,
}

export function AgentConfigPanel() {
  const { config, updateConfig, toggleTool, resetConfig, isRunning } = useAgentStore()
  const [systemOpen, setSystemOpen] = useState(false)

  const activeModel = AVAILABLE_MODELS.find((m) => m.id === config.modelId) ?? AVAILABLE_MODELS[0]
  const enabledCount = Object.values(config.enabledTools).filter(Boolean).length

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Settings2 className="h-3 w-3" /> Configuration
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetConfig}
          disabled={isRunning}
          className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          title="Reset to defaults"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          Reset
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-background/50 p-3">
        {/* Model */}
        <ConfigRow icon={Cpu} label="Model">
          <Select
            value={config.modelId}
            onValueChange={(v) => updateConfig({ modelId: v })}
            disabled={isRunning}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  <div className="flex flex-col">
                    <span>{m.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {(m.contextWindow / 1000).toFixed(0)}k ctx · ${m.costPer1k}/1k
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConfigRow>

        {/* System prompt — collapsible */}
        <Collapsible open={systemOpen} onOpenChange={setSystemOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left hover:bg-muted/50">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
              <Terminal className="h-3 w-3 text-muted-foreground" />
              System Prompt
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform",
                systemOpen && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Textarea
              value={config.systemPrompt}
              onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
              disabled={isRunning}
              className="mt-1.5 min-h-[100px] resize-y font-mono text-[11px] leading-relaxed"
              placeholder="Define the agent's persona and behavior…"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Sets the agent's persona & rules. Shown as context on each turn.
            </p>
          </CollapsibleContent>
          {!systemOpen && (
            <p className="mt-1 line-clamp-1 px-1 text-[10px] text-muted-foreground">
              {config.systemPrompt.slice(0, 60)}…
            </p>
          )}
        </Collapsible>

        {/* Temperature */}
        <ConfigRow icon={Thermometer} label="Temperature" value={config.temperature.toFixed(2)}>
          <Slider
            value={[config.temperature]}
            onValueChange={([v]) => updateConfig({ temperature: v })}
            min={0}
            max={1}
            step={0.05}
            disabled={isRunning}
            className="py-1"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>precise</span>
            <span>creative</span>
          </div>
        </ConfigRow>

        {/* Max iterations */}
        <ConfigRow icon={Repeat} label="Max Iterations" value={String(config.maxIterations)}>
          <Slider
            value={[config.maxIterations]}
            onValueChange={([v]) => updateConfig({ maxIterations: v })}
            min={1}
            max={10}
            step={1}
            disabled={isRunning}
            className="py-1"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>1</span>
            <span>caps the ReAct loop</span>
            <span>10</span>
          </div>
        </ConfigRow>

        {/* Max tokens */}
        <ConfigRow icon={Coins} label="Max Tokens" value={String(config.maxTokens)}>
          <Slider
            value={[config.maxTokens]}
            onValueChange={([v]) => updateConfig({ maxTokens: v })}
            min={256}
            max={8192}
            step={256}
            disabled={isRunning}
            className="py-1"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>256</span>
            <span>response budget</span>
            <span>8k</span>
          </div>
        </ConfigRow>
      </div>

      {/* Tools */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Wrench className="h-3 w-3" /> Tools
          </h3>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            {enabledCount}/{AVAILABLE_TOOLS.length} on
          </span>
        </div>
        <div className="space-y-1 rounded-xl border border-border bg-background/50 p-2">
          {AVAILABLE_TOOLS.map((t) => {
            const Icon = TOOL_ICONS[t.icon] ?? Wrench
            const enabled = config.enabledTools[t.name] !== false
            return (
              <div
                key={t.name}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1 transition",
                  enabled ? "bg-transparent" : "opacity-50"
                )}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded",
                    enabled
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] font-medium">{t.name}</div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleTool(t.name)}
                  disabled={isRunning}
                  className="scale-75"
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Model summary */}
      <div className="rounded-lg border border-border/60 bg-muted/30 p-2 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Active model</span>
          <span className="font-mono text-foreground">{activeModel.label}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Context window</span>
          <span className="font-mono text-foreground">{(activeModel.contextWindow / 1000).toFixed(0)}k</span>
        </div>
      </div>
    </section>
  )
}

function ConfigRow({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: typeof Cpu
  label: string
  value?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
          <Icon className="h-3 w-3 text-muted-foreground" />
          {label}
        </Label>
        {value && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground">
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
