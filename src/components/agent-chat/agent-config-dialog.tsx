"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings, Cpu, Terminal, Wrench, Globe, RotateCcw,
  Sliders, Check, Trash2, Server, Cloud, Zap, Sparkles, RefreshCw, Loader2
} from "lucide-react"
import { useAgentStore } from "@/store/agent-store"
import { AVAILABLE_TOOLS, DEFAULT_PROVIDER_URLS, LlmProvider } from "@/lib/agent-types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { CustomToolModal } from "./custom-tool-modal"
import { cn } from "@/lib/utils"

export function AgentConfigDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { config, updateConfig, toggleTool, saveCustomTool, deleteCustomTool, toggleCustomTool, resetConfig, isRunning, models, isLoadingModels, isLiveModels, loadModels } = useAgentStore()

  const handleProviderChange = (provider: LlmProvider) => {
    const defaultUrl = DEFAULT_PROVIDER_URLS[provider] || ""
    updateConfig({ provider, apiBaseUrl: defaultUrl })
    loadModels(provider, defaultUrl, config.apiKey)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" />
            <span>Configure Agent</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 bg-background border border-border shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border bg-card/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Agent Configuration</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Connect real LLMs (Ollama Local/Cloud, OpenAI, Groq, Anthropic, Gemini) with live ReAct tools.
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={resetConfig} disabled={isRunning} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
        </DialogHeader>

        {/* Tabbed Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs defaultValue="providers" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="providers" className="text-xs gap-1.5">
                <Server className="h-3.5 w-3.5" /> Provider & Models
              </TabsTrigger>
              <TabsTrigger value="parameters" className="text-xs gap-1.5">
                <Sliders className="h-3.5 w-3.5" /> Persona & Loop
              </TabsTrigger>
              <TabsTrigger value="tools" className="text-xs gap-1.5">
                <Wrench className="h-3.5 w-3.5" /> Tools & Extensions
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Providers & Dynamic Models */}
            <TabsContent value="providers" className="space-y-4">
              {/* Provider Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">LLM Provider</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    { id: "ollama_local", label: "Ollama Local", icon: Server },
                    { id: "ollama_cloud", label: "Ollama Cloud", icon: Cloud },
                    { id: "openai", label: "OpenAI", icon: Cpu },
                    { id: "anthropic", label: "Anthropic", icon: Cpu },
                    { id: "gemini", label: "Google Gemini", icon: Sparkles },
                    { id: "groq", label: "Groq Cloud", icon: Zap },
                    { id: "custom", label: "Custom / Proxy", icon: Globe },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProviderChange(p.id as LlmProvider)}
                      className={cn(
                        "flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs transition",
                        config.provider === p.id
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                          : "border-border bg-card/60 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <p.icon className="h-4 w-4 mb-1" />
                      <span className="text-[11px]">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoint & Dynamic Model Selector */}
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium">Endpoint URL</Label>
                    <Button variant="ghost" size="sm" onClick={() => loadModels()} disabled={isLoadingModels} className="h-5 text-[10px] px-1.5 text-emerald-600 dark:text-emerald-400 gap-1">
                      {isLoadingModels ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                      <span>{isLoadingModels ? "Fetching..." : "Fetch Models"}</span>
                    </Button>
                  </div>
                  <Input
                    value={config.apiBaseUrl || ""}
                    onChange={(e) => updateConfig({ apiBaseUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="h-8 font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs font-medium">Model</Label>
                      {isLiveModels && <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono">Live from Provider</Badge>}
                    </div>
                    <Select value={config.modelId} onValueChange={(v) => updateConfig({ modelId: v })} disabled={isRunning || isLoadingModels}>
                      <SelectTrigger className="h-8 w-full font-mono text-xs">
                        <SelectValue placeholder="Select model..." />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">API Key (if required)</Label>
                    <Input
                      type="password"
                      value={config.apiKey || ""}
                      onChange={(e) => updateConfig({ apiKey: e.target.value })}
                      placeholder={config.provider === "ollama_local" ? "Not needed for local" : "sk-..."}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Persona & Parameters */}
            <TabsContent value="parameters" className="space-y-4">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                  <Terminal className="h-3.5 w-3.5 text-emerald-500" /> System Persona & Instructions
                </Label>
                <Textarea
                  value={config.systemPrompt}
                  onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                  disabled={isRunning}
                  className="min-h-[120px] font-mono text-xs leading-relaxed"
                  placeholder="Define persona..."
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                <SliderRow label="Temperature" value={config.temperature.toFixed(2)} min={0} max={1} step={0.05} onChange={(v) => updateConfig({ temperature: v })} sub="0 = Precise, 1 = Creative" />
                <SliderRow label="Max ReAct Iterations" value={String(config.maxIterations)} min={1} max={10} step={1} onChange={(v) => updateConfig({ maxIterations: v })} sub="Caps the Reason-Act loop" />
                <SliderRow label="Max Tokens" value={String(config.maxTokens)} min={256} max={8192} step={256} onChange={(v) => updateConfig({ maxTokens: v })} sub="Response token budget" />
              </div>
            </TabsContent>

            {/* TAB 3: Tools & Custom Tool Builder */}
            <TabsContent value="tools" className="space-y-4">
              <div>
                <Label className="text-xs font-semibold mb-2 block">Built-in Live Tools</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_TOOLS.map((t) => {
                    const enabled = config.enabledTools[t.name] !== false
                    return (
                      <div key={t.name} className="flex items-center justify-between p-2 rounded-lg border border-border bg-card/60 text-xs">
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-mono font-medium text-[11px]">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                        </div>
                        <Switch checked={enabled} onCheckedChange={() => toggleTool(t.name)} disabled={isRunning} className="scale-75" />
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold">Custom Tool Extensions</Label>
                </div>
                {(config.customTools || []).length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {config.customTools.map((ct) => (
                      <div key={ct.id} className="flex items-center justify-between p-2 rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 text-xs">
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-mono font-medium text-emerald-600 dark:text-emerald-400 text-[11px]">{ct.name} ({ct.mode})</p>
                          <p className="text-[10px] text-muted-foreground truncate">{ct.description}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteCustomTool(ct.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <Switch checked={ct.enabled} onCheckedChange={() => toggleCustomTool(ct.id)} disabled={isRunning} className="scale-75" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <CustomToolModal onSave={saveCustomTool} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-card/40 flex justify-end">
          <Button size="sm" onClick={() => setOpen(false)} className="gap-1.5 text-xs">
            <Check className="h-3.5 w-3.5" /> Save & Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SliderRow({ label, value, min, max, step, onChange, sub }: { label: string; value: string; min: number; max: number; step: number; onChange: (v: number) => void; sub: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-[11px] text-foreground bg-muted px-1.5 py-0.5 rounded">{value}</span>
      </div>
      <Slider value={[Number(value)]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="py-1" />
      <p className="text-[9px] text-muted-foreground">{sub}</p>
    </div>
  )
}
