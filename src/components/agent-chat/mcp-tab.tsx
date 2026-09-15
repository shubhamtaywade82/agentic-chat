"use client"

import { useState } from "react"
import { useAgentStore } from "@/store/agent-store"
import type { McpServerConfig, McpTransport } from "@/lib/mcp/types"
import { mcpServerSlug } from "@/lib/mcp/types"
import {
  Plug, Plus, Trash2, Check, Loader2, AlertCircle, Server, Globe, Terminal,
  RefreshCw, Eye, EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ToolPreview {
  fullName: string
  description: string
}

interface ServerStatus {
  testing: boolean
  result?: { success: boolean; message?: string; error?: string; toolCount?: number; tools?: ToolPreview[] }
}

export function McpTab() {
  const servers = useAgentStore((s) => s.config.mcpServers || [])
  const addMcpServer = useAgentStore((s) => s.addMcpServer)
  const updateMcpServer = useAgentStore((s) => s.updateMcpServer)
  const removeMcpServer = useAgentStore((s) => s.removeMcpServer)
  const toggleMcpServer = useAgentStore((s) => s.toggleMcpServer)

  const [statusMap, setStatusMap] = useState<Record<string, ServerStatus>>({})
  const [showToolsFor, setShowToolsFor] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const testServer = async (server: McpServerConfig) => {
    setStatusMap((prev) => ({ ...prev, [server.id]: { testing: true } }))
    try {
      const res = await fetch("/api/mcp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server }),
      })
      const data = await res.json()
      setStatusMap((prev) => ({
        ...prev,
        [server.id]: {
          testing: false,
          result: {
            success: data.success,
            message: data.message,
            error: data.error,
            toolCount: data.details?.toolCount,
            tools: data.details?.tools,
          },
        },
      }))
    } catch (err) {
      setStatusMap((prev) => ({
        ...prev,
        [server.id]: {
          testing: false,
          result: { success: false, error: err instanceof Error ? err.message : String(err) },
        },
      }))
    }
  }

  const enabledCount = servers.filter((s) => s.enabled).length
  const totalToolCount = Object.values(statusMap).reduce(
    (sum, st) => sum + (st.result?.success ? st.result.toolCount || 0 : 0),
    0
  )

  return (
    <div className="space-y-4 py-2 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Plug className="h-4 w-4 text-emerald-500" />
            Model Context Protocol (MCP) Servers
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Dynamically extend the agent's tool surface. Each enabled server's tools are auto-discovered and injected into the ReAct prompt.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="h-7 gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Server
        </Button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
          <Server className="h-2.5 w-2.5" />
          {servers.length} configured
        </Badge>
        <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          {enabledCount} enabled
        </Badge>
        <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px] border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
          {totalToolCount} tools discovered
        </Badge>
      </div>

      {showAdd && (
        <AddServerForm
          onCancel={() => setShowAdd(false)}
          onSave={(server) => {
            addMcpServer(server)
            setShowAdd(false)
          }}
        />
      )}

      {/* Server list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {servers.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground border border-dashed rounded-lg">
            No MCP servers configured. Click <strong>Add Server</strong> above, or use the pre-configured reference servers in the default config.
          </div>
        ) : (
          servers.map((s) => (
            <ServerCard
              key={s.id}
              server={s}
              status={statusMap[s.id]}
              isEditing={editingId === s.id}
              showTools={showToolsFor === s.id}
              onToggle={() => toggleMcpServer(s.id)}
              onTest={() => testServer(s)}
              onEdit={() => setEditingId(editingId === s.id ? null : s.id)}
              onRemove={() => removeMcpServer(s.id)}
              onUpdate={(partial) => updateMcpServer(s.id, partial)}
              onToggleTools={() => setShowToolsFor(showToolsFor === s.id ? null : s.id)}
            />
          ))
        )}
      </div>

      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] flex items-start gap-2">
        <Plug className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong>How MCP works here:</strong> Each enabled server is spawned server-side (via <code className="font-mono text-emerald-500">npx</code>/<code className="font-mono text-emerald-500">uvx</code> for stdio, or HTTP/SSE for remote) at the start of every agent request, its tools are auto-discovered, and they're injected into the LLM's system prompt alongside the built-in tools.
          </p>
          <p>
            Tool calls use the <code className="font-mono text-emerald-500">mcp__&lt;server&gt;__&lt;tool&gt;</code> naming convention so they're unambiguously routed back to the originating server.
          </p>
        </div>
      </div>
    </div>
  )
}

function ServerCard({
  server, status, isEditing, showTools, onToggle, onTest, onEdit, onRemove, onUpdate, onToggleTools,
}: {
  server: McpServerConfig
  status?: ServerStatus
  isEditing: boolean
  showTools: boolean
  onToggle: () => void
  onTest: () => void
  onEdit: () => void
  onRemove: () => void
  onUpdate: (partial: Partial<McpServerConfig>) => void
  onToggleTools: () => void
}) {
  const slug = mcpServerSlug(server.name)
  const TransportIcon = server.transport === "stdio" ? Terminal : Globe

  return (
    <div className={cn(
      "rounded-lg border transition space-y-2",
      server.enabled ? "border-emerald-500/30 bg-emerald-500/[0.03]" : "border-border/60 bg-muted/20 opacity-70"
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <TransportIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-semibold text-[12px] truncate">{server.name}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">{server.transport}</Badge>
              {status?.result?.success && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                  {status.result.toolCount} tools
                </Badge>
              )}
              {status?.result && !status.result.success && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-500/40 text-red-600 dark:text-red-400">
                  error
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {server.description || (server.transport === "stdio"
                ? `${server.command} ${(server.args || []).join(" ")}`
                : server.url)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onTest}
            disabled={status?.testing}
            className="h-6 text-[10px] gap-1 px-2"
            title="Test connection and discover tools"
          >
            {status?.testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-500" />}
            Test
          </Button>
          {status?.result?.success && status.result.tools && status.result.tools.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleTools}
              className="h-6 text-[10px] gap-1 px-2"
              title={showTools ? "Hide tools" : "Show tools"}
            >
              {showTools ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showTools ? "Hide" : "Tools"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-6 text-[10px] gap-1 px-2"
            title="Edit server config"
          >
            <RefreshCw className="h-3 w-3" />
            Edit
          </Button>
          <Switch checked={server.enabled} onCheckedChange={onToggle} className="scale-75" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Error */}
      {status?.result && !status.result.success && status.result.error && (
        <div className="mx-2 mb-2 p-1.5 rounded border border-red-500/30 bg-red-500/5 text-[10px] text-red-600 dark:text-red-400 flex items-start gap-1">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span className="break-all">{status.result.error}</span>
        </div>
      )}

      {/* Tool list */}
      {showTools && status?.result?.success && status.result.tools && (
        <div className="mx-2 mb-2 p-2 rounded border border-border/40 bg-muted/30 space-y-1 max-h-40 overflow-y-auto">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
            Discovered tools ({status.result.tools.length})
          </p>
          {status.result.tools.map((t) => (
            <div key={t.fullName} className="flex flex-col gap-0.5">
              <code className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                {t.fullName}
              </code>
              <p className="text-[10px] text-muted-foreground ml-2">{t.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Edit form */}
      {isEditing && (
        <div className="mx-2 mb-2 p-2 rounded border border-border bg-card/60">
          <ServerForm
            initial={server}
            onSave={(updated) => {
              onUpdate(updated)
              onEdit() // close
            }}
            onCancel={onEdit}
          />
        </div>
      )}

      <div className="px-2 pb-2 text-[9px] text-muted-foreground font-mono">
        Tool prefix: <code className="text-emerald-500">mcp__{slug}__&lt;tool&gt;</code>
      </div>
    </div>
  )
}

function AddServerForm({ onCancel, onSave }: { onCancel: () => void; onSave: (s: Omit<McpServerConfig, "id">) => void }) {
  return (
    <div className="p-3 rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5">
      <ServerForm
        initial={{
          name: "",
          description: "",
          transport: "stdio",
          enabled: true,
          command: "npx",
          args: ["-y", ""],
        }}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  )
}

function ServerForm({
  initial, onSave, onCancel,
}: {
  initial: Partial<McpServerConfig>
  onSave: (s: Omit<McpServerConfig, "id">) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial.name || "")
  const [description, setDescription] = useState(initial.description || "")
  const [transport, setTransport] = useState<McpTransport>(initial.transport || "stdio")
  const [command, setCommand] = useState(initial.command || "npx")
  const [argsText, setArgsText] = useState((initial.args || []).join("\n"))
  const [envText, setEnvText] = useState(
    Object.entries(initial.env || {}).map(([k, v]) => `${k}=${v}`).join("\n")
  )
  const [url, setUrl] = useState(initial.url || "")
  const [headersText, setHeadersText] = useState(
    Object.entries(initial.headers || {}).map(([k, v]) => `${k}: ${v}`).join("\n")
  )
  const [enabled, setEnabled] = useState(initial.enabled !== false)

  const handleSave = () => {
    const args = argsText.split("\n").map((s) => s.trim()).filter(Boolean)
    const env: Record<string, string> = {}
    for (const line of envText.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
      if (m) env[m[1]] = m[2]
    }
    const headers: Record<string, string> = {}
    for (const line of headersText.split("\n")) {
      const m = line.match(/^([A-Za-z-]+):\s*(.*)$/)
      if (m) headers[m[1]] = m[2]
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      transport,
      enabled,
      command: transport === "stdio" ? command.trim() : undefined,
      args: transport === "stdio" ? args : undefined,
      env: transport === "stdio" && Object.keys(env).length > 0 ? env : undefined,
      url: transport !== "stdio" ? url.trim() : undefined,
      headers: transport !== "stdio" && Object.keys(headers).length > 0 ? headers : undefined,
    })
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px]">Server Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. my-custom-server" className="mt-1 h-8 text-xs font-mono" />
        </div>
        <div>
          <Label className="text-[11px]">Transport</Label>
          <Select value={transport} onValueChange={(v) => setTransport(v as McpTransport)}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stdio" className="text-xs">
                <span className="flex items-center gap-1.5"><Terminal className="h-3 w-3" /> stdio (local)</span>
              </SelectItem>
              <SelectItem value="http" className="text-xs">
                <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> http (remote)</span>
              </SelectItem>
              <SelectItem value="sse" className="text-xs">
                <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> sse (remote, legacy)</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-[11px]">Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this server do?" className="mt-1 h-8 text-xs" />
      </div>

      {transport === "stdio" ? (
        <>
          <div>
            <Label className="text-[11px]">Command</Label>
            <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx, uvx, node, python..." className="mt-1 h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-[11px]">Args (one per line)</Label>
            <Textarea
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              placeholder={"-y\n@modelcontextprotocol/server-memory"}
              className="mt-1 min-h-[60px] font-mono text-[11px]"
            />
          </div>
          <div>
            <Label className="text-[11px]">Env vars (KEY=value, one per line, optional)</Label>
            <Textarea
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
              placeholder={"GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx"}
              className="mt-1 min-h-[40px] font-mono text-[11px]"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label className="text-[11px]">Server URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className="mt-1 h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-[11px]">Headers (Key: value, one per line, optional)</Label>
            <Textarea
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              placeholder={"Authorization: Bearer xxx"}
              className="mt-1 min-h-[40px] font-mono text-[11px]"
            />
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-1.5 text-[11px]">
          <Switch checked={enabled} onCheckedChange={setEnabled} className="scale-75" />
          <span>Enabled</span>
        </label>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()} className="h-7 text-xs gap-1">
            <Check className="h-3 w-3" /> Save
          </Button>
        </div>
      </div>
    </div>
  )
}
