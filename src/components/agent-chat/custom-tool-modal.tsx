"use client"

import { useState } from "react"
import { Plus, Play, Check, Wrench, Code2, Globe, FileJson } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CustomTool } from "@/lib/agent-types"
import { executeCustomTool } from "@/lib/live-tools"

const PRESETS: Record<string, Partial<CustomTool>> = {
  currency: {
    name: "currency_convert",
    description: "Convert an amount between currencies using mock or live rate",
    mode: "javascript",
    code: `const rates = { USD: 1, EUR: 0.92, JPY: 155, INR: 86.5 };\nconst amount = Number(args.amount || 100);\nconst from = (args.from || "USD").toUpperCase();\nconst to = (args.to || "EUR").toUpperCase();\nconst converted = (amount / (rates[from] || 1)) * (rates[to] || 1);\nreturn { amount, from, to, result: Number(converted.toFixed(2)) };`,
  },
  github: {
    name: "github_repo_info",
    description: "Fetch public repository details from GitHub API",
    mode: "fetch",
    code: `https://api.github.com/repos/{owner}/{repo}`,
  },
  timestamp: {
    name: "timestamp_converter",
    description: "Convert a timestamp to human-readable date and time formats",
    mode: "javascript",
    code: `const ts = args.timestamp ? Number(args.timestamp) : Date.now();\nconst d = new Date(ts);\nreturn { unix: ts, iso: d.toISOString(), utc: d.toUTCString(), local: d.toLocaleString() };`,
  },
}

export function CustomToolModal({ onSave }: { onSave: (tool: CustomTool) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [mode, setMode] = useState<CustomTool["mode"]>("javascript")
  const [code, setCode] = useState("")
  const [testArgs, setTestArgs] = useState('{"amount": 100, "from": "USD", "to": "EUR"}')
  const [testOutput, setTestOutput] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const loadPreset = (key: string) => {
    const preset = PRESETS[key]
    if (!preset) return
    setName(preset.name || "")
    setDescription(preset.description || "")
    setMode(preset.mode || "javascript")
    setCode(preset.code || "")
  }

  const handleTest = async () => {
    setIsTesting(true)
    try {
      const parsedArgs = JSON.parse(testArgs || "{}")
      const dummyTool: CustomTool = { id: "test", name, description, mode, code, enabled: true }
      const res = await executeCustomTool(dummyTool, parsedArgs)
      setTestOutput(JSON.stringify(res, null, 2))
    } catch (err: unknown) {
      setTestOutput("Error: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = () => {
    if (!name.trim()) return
    const tool: CustomTool = {
      id: `custom_${Date.now()}`,
      name: name.trim().toLowerCase().replace(/\s+/g, "_"),
      description: description.trim() || `Custom ${name} tool`,
      mode,
      code,
      enabled: true,
    }
    onSave(tool)
    setOpen(false)
    setName("")
    setDescription("")
    setCode("")
    setTestOutput(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
          <Plus className="h-3 w-3 text-emerald-500" />
          Add Custom Tool
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-emerald-500" />
            Create Custom Tool
          </DialogTitle>
          <DialogDescription className="text-xs">
            Define a custom tool that the agent can call during its ReAct loop.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Preset Chips */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Load Preset Template</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Button variant="secondary" size="sm" className="h-6 text-[10px]" onClick={() => loadPreset("currency")}>
                Currency Converter
              </Button>
              <Button variant="secondary" size="sm" className="h-6 text-[10px]" onClick={() => loadPreset("github")}>
                GitHub API
              </Button>
              <Button variant="secondary" size="sm" className="h-6 text-[10px]" onClick={() => loadPreset("timestamp")}>
                Timestamp Tool
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Tool Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. crypto_price"
                className="mt-1 h-8 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px]">Execution Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as CustomTool["mode"])}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript" className="text-xs">
                    <span className="flex items-center gap-1.5"><Code2 className="h-3 w-3" /> JavaScript</span>
                  </SelectItem>
                  <SelectItem value="fetch" className="text-xs">
                    <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> HTTP Fetch</span>
                  </SelectItem>
                  <SelectItem value="static" className="text-xs">
                    <span className="flex items-center gap-1.5"><FileJson className="h-3 w-3" /> Static JSON</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-[11px]">Description (Instructs Agent when to use this tool)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Look up real-time cryptocurrency ticker prices"
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div>
            <Label className="text-[11px]">Tool Code / URL Template</Label>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={mode === "fetch" ? "https://api.example.com/v1/{query}" : "return { result: args.input * 2 };"}
              className="mt-1 min-h-[90px] font-mono text-[11px]"
            />
          </div>

          {/* Test area */}
          <div className="rounded-lg border border-border/80 bg-muted/30 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium">Test Parameters (JSON)</Label>
              <Button variant="ghost" size="sm" onClick={handleTest} disabled={isTesting || !code} className="h-6 gap-1 px-2 text-[10px]">
                <Play className="h-2.5 w-2.5 text-emerald-500" />
                Run Test
              </Button>
            </div>
            <Input
              value={testArgs}
              onChange={(e) => setTestArgs(e.target.value)}
              className="h-7 font-mono text-[10px]"
            />
            {testOutput && (
              <pre className="max-h-24 overflow-auto rounded bg-zinc-950 p-2 font-mono text-[10px] text-zinc-300">
                {testOutput}
              </pre>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()} className="gap-1">
            <Check className="h-3.5 w-3.5" />
            Save Tool
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
