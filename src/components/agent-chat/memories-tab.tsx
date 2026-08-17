"use client"

import { useState } from "react"
import { useAgentStore } from "@/store/agent-store"
import type { AgentMemoryItem, MemoryCategory } from "@/lib/agent-types"
import {
  Brain, Plus, Trash2, Check, Sparkles, SlidersHorizontal, BookOpen,
  TrendingUp, Shield, Lightbulb
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const CATEGORY_META: Record<MemoryCategory, { label: string; icon: typeof Brain; color: string }> = {
  preference: { label: "User Preference", icon: Sparkles, color: "text-purple-500 border-purple-500/30 bg-purple-500/10" },
  trading_fact: { label: "Trading Fact", icon: TrendingUp, color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" },
  learned_pattern: { label: "Learned Pattern", icon: Brain, color: "text-blue-500 border-blue-500/30 bg-blue-500/10" },
  user_instruction: { label: "Instruction", icon: Shield, color: "text-amber-500 border-amber-500/30 bg-amber-500/10" },
}

export function MemoriesTab() {
  const memories = useAgentStore((s) => s.config.memories || [])
  const addMemory = useAgentStore((s) => s.addMemory)
  const deleteMemory = useAgentStore((s) => s.deleteMemory)
  const toggleMemory = useAgentStore((s) => s.toggleMemory)

  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [category, setCategory] = useState<MemoryCategory>("trading_fact")

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    addMemory({
      title: title.trim(),
      content: content.trim(),
      category,
      source: "user",
      enabled: true,
    })
    setTitle("")
    setContent("")
    setShowAdd(false)
  }

  const filtered = memories.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.content.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 py-2 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Brain className="h-4 w-4 text-emerald-500" />
            Agent Long-Term Memory & Learning
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Facts, learned self-corrections, and trading preferences injected automatically into the ReAct prompt.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="h-7 gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Memory
        </Button>
      </div>

      {showAdd && (
        <form onSubmit={handleSave} className="p-3 rounded-lg border border-border bg-card/60 space-y-2.5">
          <div className="flex gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Memory title (e.g. Preferred Timeframe)..."
              className="h-8 text-xs flex-1"
              required
            />
            <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trading_fact">Trading Fact</SelectItem>
                <SelectItem value="preference">User Preference</SelectItem>
                <SelectItem value="learned_pattern">Learned Pattern</SelectItem>
                <SelectItem value="user_instruction">Instruction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe what the agent should remember and apply..."
            className="text-xs min-h-[60px]"
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="h-7 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-7 text-xs gap-1">
              <Check className="h-3 w-3" /> Save Memory
            </Button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter memories by keyword..."
        className="h-7 text-xs"
      />

      {/* Memory List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground border border-dashed rounded-lg">
            No memories match your filter. Type <code className="font-mono text-emerald-500">/learn ...</code> in chat to teach the agent!
          </div>
        ) : (
          filtered.map((m) => {
            const meta = CATEGORY_META[m.category] || CATEGORY_META.trading_fact
            const Icon = meta.icon
            return (
              <div
                key={m.id}
                className={cn(
                  "p-2.5 rounded-lg border transition space-y-1.5",
                  m.enabled ? "border-border bg-card/60" : "border-border/40 bg-muted/20 opacity-60"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("gap-1 px-1.5 py-0 text-[10px]", meta.color)}>
                      <Icon className="h-2.5 w-2.5" />
                      {meta.label}
                    </Badge>
                    <span className="font-semibold text-foreground/90">{m.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={m.enabled}
                      onCheckedChange={() => toggleMemory(m.id)}
                      className="scale-75"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMemory(m.id)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed text-[11px]">{m.content}</p>
              </div>
            )
          })
        )}
      </div>

      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
        <span>
          <strong>Tip:</strong> In the chat box, type <code className="font-mono text-emerald-600 dark:text-emerald-400">/learn &lt;instruction&gt;</code> to teach the agent anytime on the fly!
        </span>
      </div>
    </div>
  )
}
