"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  LayoutDashboard,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Bot,
  LineChart,
} from "lucide-react"
import { useAgentStore } from "@/store/agent-store"
import { OpenUIAnswerRenderer } from "@/components/agent-chat/openui-answer"
import { OPENUI_PRESETS } from "./presets"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ThemeToggle } from "@/components/theme-toggle"

export function OpenUIPlayground() {
  const config = useAgentStore((s) => s.config)
  const updateConfig = useAgentStore((s) => s.updateConfig)
  const [selectedPresetId, setSelectedPresetId] = useState(OPENUI_PRESETS[0].id)
  const [code, setCode] = useState(OPENUI_PRESETS[0].code)
  const [copied, setCopied] = useState(false)

  const handleSelectPreset = (id: string) => {
    const p = OPENUI_PRESETS.find((x) => x.id === id)
    if (!p) return
    setSelectedPresetId(id)
    setCode(p.code)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    const p = OPENUI_PRESETS.find((x) => x.id === selectedPresetId)
    if (p) setCode(p.code)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              <Bot className="h-3.5 w-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Agent Chat</span>
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
            <Link href="/dashboard">
              <LineChart className="h-3.5 w-3.5 text-cyan-500" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-semibold">OpenUI Surface</h1>
                <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                  Thesys Generative UI
                </Badge>
              </div>
              <p className="hidden text-[10px] text-muted-foreground md:block">
                Progressive DSL rendering with domain cards, tables, and actions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-1 text-xs sm:flex">
            <span className="text-[11px] text-muted-foreground">Chat Generative UI:</span>
            <span className={`text-[11px] font-semibold ${config.openuiEnabled ? "text-emerald-500" : "text-muted-foreground"}`}>
              {config.openuiEnabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={config.openuiEnabled === true}
              onCheckedChange={(v) => updateConfig({ openuiEnabled: v })}
              className="scale-75"
            />
          </div>

          <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
            <a href="https://www.openui.com/docs" target="_blank" rel="noopener noreferrer">
              <span>Docs</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>

          <ThemeToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Preset tabs + Code Editor */}
        <section className="flex flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex items-center gap-1 overflow-x-auto scroll-thin py-0.5">
              {OPENUI_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`shrink-0 rounded px-2 py-1 text-[11px] font-medium transition ${
                    selectedPresetId === p.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 pl-2">
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground">
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="relative flex-1 p-3 overflow-hidden flex flex-col">
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 resize-none font-mono text-xs leading-relaxed scroll-thin bg-card/40 border-border"
              placeholder="Enter OpenUI Lang (e.g. Stack { BinancePriceCard(...) })"
              spellCheck={false}
            />
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>OpenUI Lang DSL • Live Progressive Parser</span>
              <span>Tokens: ~67% fewer than raw JSON</span>
            </div>
          </div>

          {/* Component Catalog summary */}
          <footer className="border-t border-border bg-card/40 p-2.5">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Domain Component Library (11 Registered)</p>
            <div className="flex flex-wrap gap-1">
              {[
                "Stack", "Text", "BinancePriceCard", "OrderBookTable",
                "TradeSetupCard", "FundingRateCard", "RiskCalculatorCard",
                "StatBlock", "ActionButton", "HtmlArtifact", "MarkdownFallback",
              ].map((name) => (
                <Badge key={name} variant="secondary" className="font-mono text-[9px] py-0 px-1.5">
                  {name}
                </Badge>
              ))}
            </div>
          </footer>
        </section>

        {/* Right Column: Live Rendered Output */}
        <section className="flex flex-1 flex-col overflow-hidden bg-muted/10">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span>Live Generative UI Output</span>
            </div>
            <Badge variant="outline" className="text-[9px] font-mono border-border">
              &lt;Renderer /&gt;
            </Badge>
          </div>

          <div className="scroll-thin flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-xl">
              <OpenUIAnswerRenderer
                content={code}
                isStreaming={false}
                mcpServerConfig={config.mcpServers || []}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
