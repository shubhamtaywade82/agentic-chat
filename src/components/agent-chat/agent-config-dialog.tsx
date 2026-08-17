"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings, Cpu, Terminal, Wrench, RotateCcw,
  Sliders, Check, Trash2, Server, Cloud, Zap, Sparkles, RefreshCw, Loader2, KeyRound, Plus, ShieldCheck,
  TrendingUp, IndianRupee, CheckCircle2, AlertCircle
} from "lucide-react"
import { useAgentStore } from "@/store/agent-store"
import { AVAILABLE_TOOLS, DEFAULT_PROVIDER_URLS, DhanAuthMode, LlmProvider } from "@/lib/agent-types"
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
  const [newKeyLabel, setNewKeyLabel] = useState("")
  const [newKeyValue, setNewKeyValue] = useState("")
  const [showAddKey, setShowAddKey] = useState(false)
  const [dhanTesting, setDhanTesting] = useState(false)
  const [dhanStatus, setDhanStatus] = useState<{ ok?: boolean; msg?: string } | null>(null)

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

  const testDhanConnection = async () => {
    setDhanTesting(true)
    setDhanStatus(null)
    try {
      const res = await fetch("/api/trading/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "dhan", dhan: config.dhan }),
      })
      const data = await res.json()
      setDhanStatus({ ok: res.ok && data.success, msg: data.message || data.error || "Verified" })
    } catch (err: unknown) {
      setDhanStatus({ ok: false, msg: err instanceof Error ? err.message : "Connection failed" })
    } finally {
      setDhanTesting(false)
    }
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
                  LLM providers, ReAct parameters, and DhanHQ / Binance trading integration.
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={resetConfig} disabled={isRunning} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs defaultValue="providers" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="providers" className="text-[11px] gap-1"><Server className="h-3 w-3" /> Providers</TabsTrigger>
              <TabsTrigger value="trading" className="text-[11px] gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" /> Trading</TabsTrigger>
              <TabsTrigger value="parameters" className="text-[11px] gap-1"><Sliders className="h-3 w-3" /> Persona</TabsTrigger>
              <TabsTrigger value="tools" className="text-[11px] gap-1"><Wrench className="h-3 w-3" /> Tools</TabsTrigger>
            </TabsList>

            {/* TAB 1: Providers & Dynamic Models */}
            <TabsContent value="providers" className="space-y-4">
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
                    { id: "custom", label: "Custom Proxy", icon: Server },
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

              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium">Endpoint URL</Label>
                    <Button variant="ghost" size="sm" onClick={() => loadModels()} disabled={isLoadingModels} className="h-5 text-[10px] px-1.5 text-emerald-600 dark:text-emerald-400 gap-1">
                      {isLoadingModels ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                      <span>{isLoadingModels ? "Fetching..." : "Fetch Models"}</span>
                    </Button>
                  </div>
                  <Input value={config.apiBaseUrl || ""} onChange={(e) => updateConfig({ apiBaseUrl: e.target.value })} placeholder="http://localhost:11434" className="h-8 font-mono text-xs" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium">Model</Label>
                    {isLiveModels && <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono">Live from Provider</Badge>}
                  </div>
                  <Select value={config.modelId} onValueChange={(v) => updateConfig({ modelId: v })} disabled={isRunning || isLoadingModels}>
                    <SelectTrigger className="h-8 w-full font-mono text-xs"><SelectValue placeholder="Select model..." /></SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (<SelectItem key={m.id} value={m.id} className="text-xs font-mono">{m.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-1 border-t border-border/60">
                  {isLocalOllama ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      <span>Local Ollama instances do not require an API key.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5 text-emerald-500" /> Multiple API Keys ({currentProviderKeys.length} saved)
                        </Label>
                        <Button variant="ghost" size="sm" onClick={() => setShowAddKey(!showAddKey)} className="h-5 text-[10px] px-1.5 text-emerald-600 dark:text-emerald-400 gap-1">
                          <Plus className="h-2.5 w-2.5" /> {showAddKey ? "Cancel" : "Add Key"}
                        </Button>
                      </div>

                      {showAddKey && (
                        <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-2">
                          <Input value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} placeholder="Key Label (e.g. Primary Cloud, Backup)" className="h-7 text-xs" />
                          <Input type="password" value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} placeholder="Enter API Key / Token" className="h-7 text-xs" />
                          <Button size="sm" onClick={handleSaveNewKey} disabled={!newKeyValue.trim()} className="h-6 text-[10px] gap-1">
                            <Check className="h-2.5 w-2.5" /> Save API Key
                          </Button>
                        </div>
                      )}

                      {currentProviderKeys.length > 0 ? (
                        <div className="space-y-1">
                          {currentProviderKeys.map((k) => (
                            <div key={k.id} className={cn("flex items-center justify-between p-1.5 rounded-md border text-xs", config.apiKey === k.key ? "border-emerald-500/40 bg-emerald-500/5 font-medium" : "border-border bg-card/40")}>
                              <span className="truncate max-w-[240px] text-[11px]">{k.label} ({k.key.slice(0, 6)}...{k.key.slice(-4)})</span>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => updateConfig({ apiKey: k.key })} className={cn("h-5 text-[9px] px-1.5", config.apiKey === k.key && "text-emerald-600 dark:text-emerald-400 font-bold")}>
                                  {config.apiKey === k.key ? "Active" : "Use"}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => removeApiKey(k.id)} className="h-5 w-5 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Input type="password" value={config.apiKey || ""} onChange={(e) => updateConfig({ apiKey: e.target.value })} placeholder="Enter API Key (sk-...)" className="h-8 text-xs" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Trading & Market Data (DhanHQ + Binance) */}
            <TabsContent value="trading" className="space-y-4">
              {/* Binance Section */}
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    <div>
                      <h4 className="text-xs font-semibold">Binance USD-M & Spot Market Data</h4>
                      <p className="text-[10px] text-muted-foreground">Public market data (prices, klines, order book, open interest, funding rates).</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono">
                    Zero Auth Required
                  </Badge>
                </div>
              </div>

              {/* DhanHQ Section */}
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-emerald-500" />
                    <div>
                      <h4 className="text-xs font-semibold">DhanHQ Indian Markets (NSE / BSE / MCX / F&O)</h4>
                      <p className="text-[10px] text-muted-foreground">Configure authentication for real-time quotes, option chains, and holdings.</p>
                    </div>
                  </div>
                </div>

                {/* Auth Mode Switcher */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateConfig({ dhan: { ...config.dhan, authMode: "endpoint" } })}
                    className={cn(
                      "p-2 rounded-lg border text-left text-xs transition",
                      config.dhan.authMode === "endpoint" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium" : "border-border bg-card/60 text-muted-foreground"
                    )}
                  >
                    <p className="font-semibold text-[11px]">Option B: Auth Endpoint</p>
                    <p className="text-[10px] text-muted-foreground">Auto-fetch token from server</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig({ dhan: { ...config.dhan, authMode: "direct" } })}
                    className={cn(
                      "p-2 rounded-lg border text-left text-xs transition",
                      config.dhan.authMode === "direct" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium" : "border-border bg-card/60 text-muted-foreground"
                    )}
                  >
                    <p className="font-semibold text-[11px]">Option A: Direct Static Token</p>
                    <p className="text-[10px] text-muted-foreground">Direct DHAN_TOKEN & CLIENT_ID</p>
                  </button>
                </div>

                {config.dhan.authMode === "endpoint" ? (
                  <div className="space-y-2 pt-1">
                    <div>
                      <Label className="text-[11px] font-medium mb-1 block">Auth Service Endpoint</Label>
                      <Input
                        value={config.dhan.endpointBaseUrl || ""}
                        onChange={(e) => updateConfig({ dhan: { ...config.dhan, endpointBaseUrl: e.target.value } })}
                        placeholder="https://algo-trading-api.onrender.com"
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium mb-1 block">Bearer Access Token (DHAN_TOKEN_ACCESS_TOKEN)</Label>
                      <Input
                        type="password"
                        value={config.dhan.bearerToken || ""}
                        onChange={(e) => updateConfig({ dhan: { ...config.dhan, bearerToken: e.target.value } })}
                        placeholder="Enter bearer token..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label className="text-[11px] font-medium mb-1 block">Dhan Client ID</Label>
                      <Input
                        value={config.dhan.clientId || ""}
                        onChange={(e) => updateConfig({ dhan: { ...config.dhan, clientId: e.target.value } })}
                        placeholder="1100..."
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium mb-1 block">Dhan Token (JWT)</Label>
                      <Input
                        type="password"
                        value={config.dhan.token || ""}
                        onChange={(e) => updateConfig({ dhan: { ...config.dhan, token: e.target.value } })}
                        placeholder="ey..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Button variant="outline" size="sm" onClick={testDhanConnection} disabled={dhanTesting} className="h-7 text-xs gap-1.5">
                    {dhanTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    <span>{dhanTesting ? "Verifying..." : "Test Dhan Connection"}</span>
                  </Button>
                  {dhanStatus && (
                    <span className={cn("text-[11px] flex items-center gap-1", dhanStatus.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                      {dhanStatus.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      <span className="truncate max-w-[260px]">{dhanStatus.msg}</span>
                    </span>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Persona & Parameters */}
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

            {/* TAB 4: Tools & Custom Tool Extensions */}
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
      <Slider value={[Number(value)]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="py-1" />
      <p className="text-[9px] text-muted-foreground">{sub}</p>
    </div>
  )
}
