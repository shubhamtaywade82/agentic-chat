"use client"

import { useState } from "react"
import { useAgentStore } from "@/store/agent-store"
import { AgentConfigDialog } from "./agent-config-dialog"
import { searchSessions } from "@/lib/memory-engine"
import { MessageSquare, PanelLeftClose, Plus, Trash2, X, Sliders, Search, Pencil, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const [sessionSearch, setSessionSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const { sessions, activeSessionId, createNewSession, switchSession, deleteSession, renameSession, toggleSidebar } = useAgentStore()

  const filteredSessions = searchSessions(sessions, sessionSearch)

  const handleStartRename = (s: { id: string; title: string }, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(s.id)
    setEditTitle(s.title)
  }

  const handleSaveRename = (id: string, e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (editTitle.trim()) {
      renameSession(id, editTitle.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex h-full flex-col bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">Chat Sessions</h2>
            <p className="text-[10px] text-muted-foreground font-mono">{sessions.length} session{sessions.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={onClose}><X className="h-4 w-4" /></Button>
        ) : (
          <Button variant="ghost" size="icon" className="hidden h-7 w-7 lg:flex" onClick={toggleSidebar} title="Collapse sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Sessions List */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1.5 p-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={createNewSession} className="h-6 gap-1 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Plus className="h-2.5 w-2.5" /> New Session
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <Input
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              placeholder="Search past sessions..."
              className="h-6 pl-6 text-[10px] bg-background/50"
            />
          </div>

          <div className="space-y-1 rounded-lg border border-border/70 bg-background/50 p-1.5">
            {filteredSessions.length === 0 ? (
              <div className="p-2 text-center text-[10px] text-muted-foreground">No sessions found</div>
            ) : (
              filteredSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs transition",
                    s.id === activeSessionId ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {editingId === s.id ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(s.id, e)
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        autoFocus
                        className="h-5 text-[11px] py-0 px-1 flex-1 bg-background"
                      />
                      <button
                        onClick={(e) => handleSaveRename(s.id, e)}
                        className="p-0.5 text-emerald-400 hover:text-emerald-300"
                        title="Save name"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate max-w-[170px]" title={s.title}>{s.title}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => handleStartRename(s, e)}
                          className="hover:text-cyan-400 transition p-0.5 text-muted-foreground"
                          title="Rename chat"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {sessions.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                            className="hover:text-destructive transition p-0.5 text-muted-foreground"
                            title="Delete chat"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer with Backdrop Configuration Button */}
      <div className="p-3 border-t border-border bg-background/40">
        <AgentConfigDialog
          trigger={
            <Button variant="outline" size="sm" className="w-full justify-center gap-1.5 text-xs h-8 bg-background shadow-xs hover:bg-muted">
              <Sliders className="h-3.5 w-3.5 text-emerald-500" />
              <span>Configure Agent & Memory</span>
            </Button>
          }
        />
      </div>
    </div>
  )
}
