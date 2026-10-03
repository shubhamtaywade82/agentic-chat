"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAgentStore } from "@/store/agent-store"

/**
 * What the connected Nexum server offers, plus the one client-side preference
 * (OpenUI). Model, tools, credentials and MCP are configured on the server.
 */
export function NexumDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { config, updateConfig, isRunning, capabilities, capabilitiesError, loadCapabilities } = useAgentStore()
  const openuiSupported = capabilities?.outputFormats.includes("openui") ?? false

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void loadCapabilities()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nexum</DialogTitle>
          <DialogDescription>
            {capabilities
              ? `Connected · protocol ${capabilities.protocolVersion}`
              : (capabilitiesError ?? "Connecting…")}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="output" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="tools">Tools{capabilities && ` (${capabilities.tools.length})`}</TabsTrigger>
            <TabsTrigger value="skills">Skills{capabilities && ` (${capabilities.skills.length})`}</TabsTrigger>
            <TabsTrigger value="models">Models{capabilities && ` (${capabilities.models.length})`}</TabsTrigger>
            <TabsTrigger value="mcp">MCP{capabilities && ` (${capabilities.mcp.length})`}</TabsTrigger>
          </TabsList>

          <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <TabsContent value="output">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Generative UI answers (OpenUI)</Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Lets the agent answer with cards, tables and charts where the data fits. Nexum decides when
                    that applies and labels the result; plain text still renders as Markdown.
                    {!openuiSupported && " The connected server cannot produce OpenUI output."}
                  </p>
                </div>
                <Switch
                  checked={config.openuiEnabled}
                  onCheckedChange={(v) => updateConfig({ openuiEnabled: v })}
                  disabled={isRunning || !openuiSupported}
                />
              </div>
            </TabsContent>

            <TabsContent value="tools">
              <List
                items={capabilities?.tools.map((t) => ({
                  key: t.id,
                  title: t.id,
                  detail: t.description,
                  badges: [t.pack, `risk: ${t.risk}`, ...(t.uiInvocable ? ["UI"] : [])],
                }))}
              />
            </TabsContent>
            <TabsContent value="skills">
              <List
                items={capabilities?.skills.map((s) => ({
                  key: s.id,
                  title: s.name,
                  detail: s.description,
                  badges: [s.scope, ...s.tags],
                }))}
              />
            </TabsContent>
            <TabsContent value="models">
              <List
                items={capabilities?.models.map((m) => ({ key: m.name, title: m.name, badges: m.capabilities }))}
              />
            </TabsContent>
            <TabsContent value="mcp">
              <List items={capabilities?.mcp.map((s) => ({ key: s.name, title: s.name, badges: [`trust: ${s.trust}`] }))} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

interface ListItem {
  key: string
  title: string
  detail?: string
  badges: string[]
}

function List({ items }: { items?: ListItem[] }) {
  if (!items) return <p className="text-xs text-muted-foreground">Not available.</p>
  if (items.length === 0) return <p className="text-xs text-muted-foreground">None.</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.key} className="rounded-lg border border-border px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-medium">{item.title}</span>
            {item.badges.map((badge) => (
              <Badge key={badge} variant="secondary" className="text-[10px]">
                {badge}
              </Badge>
            ))}
          </div>
          {item.detail && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.detail}</p>}
        </li>
      ))}
    </ul>
  )
}
