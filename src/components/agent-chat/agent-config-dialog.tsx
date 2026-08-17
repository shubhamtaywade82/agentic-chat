"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings, Cpu, Terminal, Wrench, RotateCcw,
  Sliders, Check, Trash2, Server, Cloud, Zap, Sparkles, RefreshCw, Loader2, KeyRound, Plus,
  TrendingUp, Brain
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
import { TradingTab } from "./trading-tab"
import { MemoriesTab } from "./memories-tab"
import { cn } from "@/lib/utils"

export function AgentConfigDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState("")
  const [newKeyValue, setNewKeyValue] = useState("")
  const [showAddKey, setShowAddKey] = useState(false)

  const {
    config, updateConfig, addApiKey, removeApiKey, toggleTool,
    saveCustomTool, deleteCustomTool, toggleCustomTool, resetConfig,
    isRunning, models, isLoadingModels, isLiveModels, loadModels
  } = useAgentStore()

  const isLocalOllama = config.provider === "ollama_local"
  const currentProviderKeys = (config.apiKeys || []).filter((k) => k.provider === config.provider)

  const handleProviderChange = (provider: LlmProvider) => {
    const defaultUrl = DEFAULT_PROVIDER_URLS[provider] || ""
    const matchingKey = (config.apiKeys || []).find((k) => k.provider === provider)?.key || ""
    updateConfig({ provider, apiBaseUrl: defaultUrl, apiKey: matchingKey })
    loadModels(provider, defaultUrl, matchingKey)
  }

  const handleSaveNewKey = () => {
    if (!newKeyValue.trim()) return
    addApiKey(newKeyValue.trim(), newKeyLabel.trim())
    setNewKeyValue("")
    setNewKeyLabel("")
    setShowAddKey(false)
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
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border bg-card/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Agent Configuration</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  LLM providers, ReAct parameters, memories, and trading integrations.
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={resetConfig} className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1">
              <RotateCcw className="h-3 w-3" /> Reset Defaults
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs defaultValue="model" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="model" className="gap-1 text-xs">
                <Cpu className="h-3.5 w-3.5" /> Model
              </TabsTrigger>
              <TabsTrigger value="trading" className="gap-1 text-xs">
                <TrendingUp className="h-3.5 w-3.5" /> Trading
              </TabsTrigger>
              <TabsTrigger value="memories" className="gap-1 text-xs">
                <Brain className="h-3.5 w-3.5" /> Memory
              </TabsTrigger>
              <TabsTrigger value="parameters" className="gap-1 text-xs">
                <Sliders className="h-3.5 w-3.5" /> Persona
              </TabsTrigger>
              <TabsTrigger value="tools" className="gap-1 text-xs">
                <Wrench className="h-3.5 w-3.5" /> Tools
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: LLM Provider & Models */}
            <TabsContent value="model" className="space-y-4">
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">LLM Provider</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "ollama_local" as const, label: "Ollama (Local)", icon: Server, desc: "Zero API Key" },
                    { id: "ollama_cloud" as const, label: "Ollama (Cloud/Custom)", icon: Cloud, desc: "Remote host" },
                    { id: "openai" as const, label: "OpenAI", icon: Zap, desc: "GPT-4o, o3-mini" },
                    { id: "anthropic" as const, label: "Anthropic", icon: Sparkles, desc: "Claude 3.5 Sonnet" },
                    { id: "gemini" as const, label: "Google Gemini", icon: Sparkles, desc: "Gemini 2.0 Flash" },
                    { id: "groq" as const, label: "Groq (Fast)", icon: Zap, desc: "Llama 3.3 70B" },
                  ].map((p) => {
                    const Icon = p.icon
                    const isSelected = config.provider === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProviderChange(p.id)}
                        className={cn(
                          "flex flex-col items-start p-2.5 rounded-lg border text-left transition",
                          isSelected
                            ? "border-emerald-500 bg-emerald-500/10 text-foreground shadow-sm"
                            : "border-border hover:border-border/80 bg-card/60 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-1.5 font-medium text-xs">
                          <Icon className={cn("h-3.5 w-3.5", isSelected ? "text-emerald-500" : "text-muted-foreground")} />
                          <span>{p.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium mb-1 block">API Base URL</Label>
                <Input
                  value={config.apiBaseUrl}
                  onChange={(e) => updateConfig({ apiBaseUrl: e.target.value })}
                  placeholder={DEFAULT_PROVIDER_URLS[config.provider] || "http://localhost:11434"}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {!isLocalOllama && (
                <div className="space-y-2 p-3 rounded-lg border border-border bg-card/60">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-emerald-500" /> API Keys for {config.provider}
                    </Label>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddKey(!showAddKey)} className="h-6 text-[10px] gap-1 px-2">
                      <Plus className="h-3 w-3" /> Add Key
                    </Button>
                  </div>

                  {currentProviderKeys.length > 0 && (
                    <div className="space-y-1">
                      {currentProviderKeys.map((k) => (
                        <div key={k.id} className="flex items-center justify-between p-1.5 rounded bg-muted/40 text-xs">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="activeKey"
                              checked={config.apiKey === k.key}
                              onChange={() => updateConfig({ apiKey: k.key })}
                              className="accent-emerald-500"
                            />
                            <span className="font-medium text-[11px]">{k.label}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">••••{k.key.slice(-4)}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeApiKey(k.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showAddKey && (
                    <div className="flex gap-1.5 pt-1">
                      <Input value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} placeholder="Key Label..." className="h-7 text-xs flex-1" />
                      <Input type="password" value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} placeholder="Secret Key..." className="h-7 text-xs flex-1" />
                      <Button size="sm" onClick={handleSaveNewKey} className="h-7 text-xs px-2">Save</Button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-semibold">Active Model</Label>
                  <div className="flex items-center gap-2">
                    {isLiveModels && <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-500">Live Provider</Badge>}
                    <Button variant="ghost" size="sm" onClick={() => loadModels(config.provider, config.apiBaseUrl, config.apiKey)} disabled={isLoadingModels} className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground">
                      <RefreshCw className={cn("h-2.5 w-2.5", isLoadingModels && "animate-spin")} /> Refresh
                    </Button>
                  </div>
                </div>
                <Select value={config.modelId} onValueChange={(val) => updateConfig({ modelId: val })}>
                  <SelectTrigger className="h-9 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                        {m.label} ({m.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* TAB 2: Trading & Market Data */}
            <TabsContent value="trading">
              <TradingTab />
            </TabsContent>

            {/* TAB 3: Agent Long-Term Memory & Learning */}
            <TabsContent value="memories">
              <MemoriesTab />
            </TabsContent>

            {/* TAB 4: Persona & Parameters */}
            <TabsContent value="parameters" className="space-y-4">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                  <Terminal className="h-3.5 w-3.5 text-emerald-500" /> System Persona & Instructions
                </Label>
                <Textarea value={config.systemPrompt} onChange={(e) => updateConfig({ systemPrompt: e.target.value })} disabled={isRunning} className="min-h-[120px] font-mono text-xs leading-relaxed" placeholder="Define persona..." />
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                <SliderRow label="Temperature" value={config.temperature.toFixed(2)} min={0} max={1} step={0.05} onChange={(v) => updateConfig({ temperature: v })} sub="0 = Precise, 1 = Creative" />
                <SliderRow label="Max ReAct Iterations" value={String(config.maxIterations)} min={1} max={10} step={1} onChange={(v) => updateConfig({ maxIterations: v })} sub="Caps the Reason-Act loop" />
                <SliderRow label="Max Tokens" value={String(config.maxTokens)} min={256} max={8192} step={256} onChange={(v) => updateConfig({ maxTokens: v })} sub="Response token budget" />
              </div>
            </TabsContent>

            {/* TAB 5: Tools & Custom Tool Extensions */}
            <TabsContent value="tools" className="space-y-4">
              <div>
                <Label className="text-xs font-semibold mb-2 block">Built-in Live Tools & Skills</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_TOOLS.map((t) => (
                    <div key={t.name} className="flex items-center justify-between p-2 rounded-lg border border-border bg-card/60 text-xs">
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-1">
                          <p className="font-mono font-medium text-[11px]">{t.name}</p>
                          {t.category === "crypto" && <span className="text-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-0 rounded">Crypto</span>}
                          {t.category === "indian_markets" && <span className="text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0 rounded">Dhan</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                      </div>
                      <Switch checked={config.enabledTools[t.name] !== false} onCheckedChange={() => toggleTool(t.name)} disabled={isRunning} className="scale-75" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block">Custom Tool Extensions</Label>
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
      <Slider min={min} max={max} step={step} value={[Number(value)]} onValueChange={([val]) => onChange(val)} />
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </div>
  )
}
