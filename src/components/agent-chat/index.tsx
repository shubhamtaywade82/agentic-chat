"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useAgentStore } from "@/store/agent-store"
import { AgentMessageView } from "./agent-message"
import { UserMessageView } from "./user-message"
import { ChatInput } from "./chat-input"
import { Sidebar } from "./sidebar"
import { AgentConfigDialog } from "./agent-config-dialog"
import { LiveTickerBar } from "./live-ticker-bar"
import { Bot, PanelLeft, PanelLeftOpen, Trash2, Zap, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { DEFAULT_CONFIG } from "@/lib/agent-types"

const emptySubscribe = () => () => {}

export function AgentChat() {
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const messages = useAgentStore((s) => s.messages)
  const isRunning = useAgentStore((s) => s.isRunning)
  const activeMessageId = useAgentStore((s) => s.activeMessageId)
  const config = useAgentStore((s) => s.config)
  const clear = useAgentStore((s) => s.clear)
  const hydrateFromStorage = useAgentStore((s) => s.hydrateFromStorage)
  const sidebarCollapsed = useAgentStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAgentStore((s) => s.toggleSidebar)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  // auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, activeMessageId, isRunning])

  const activeProvider = isMounted ? config.provider : DEFAULT_CONFIG.provider
  const activeModel = isMounted ? config.modelId : DEFAULT_CONFIG.modelId

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden">
              <PanelLeft className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
            <SheetTitle className="sr-only">Agent runtime visualizer panel</SheetTitle>
            <SheetDescription className="sr-only">
              ReAct loop visualization, session telemetry, and sessions list
            </SheetDescription>
            <Sidebar onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        {sidebarCollapsed && (
          <Button variant="ghost" size="icon" className="hidden h-9 w-9 lg:flex" onClick={toggleSidebar} title="Expand sidebar">
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold">ReAct Agent Playground</h1>
            <p className="hidden text-[10px] text-muted-foreground sm:block">
              Live ReAct loop visualization · Reason · Act · Observe
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
            <Zap className="h-2.5 w-2.5" /> Real LLM
          </Badge>

          {/* Settings Backdrop Trigger in Header */}
          <AgentConfigDialog
            trigger={
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs font-mono">
                <Settings className="h-3 w-3 text-muted-foreground" />
                <span className="hidden sm:inline">{activeProvider.replace(/_/g, " ")}:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeModel}</span>
              </Button>
            }
          />

          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} className="h-7 gap-1 px-2 text-[10px] text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </header>

      {/* Live WebSocket Ticker Stream Bar */}
      <LiveTickerBar />

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {!sidebarCollapsed && (
          <aside className="hidden h-full w-[300px] shrink-0 overflow-hidden border-r border-border lg:block">
            <Sidebar />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                messages.map((m) =>
                  m.role === "user" ? (
                    <UserMessageView key={m.id} content={m.content ?? ""} />
                  ) : (
                    <AgentMessageView key={m.id} message={m} />
                  )
                )
              )}
            </div>
          </div>
          <ChatInput />
        </main>
      </div>

      {/* Footer */}
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-background px-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Agent runtime online · Connected to {activeProvider.replace(/_/g, " ")}
        </span>
        <span className="font-mono">ReAct = Reason + Act + Observe · loop until answer</span>
      </footer>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/20" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
          <Bot className="h-7 w-7" />
        </div>
      </div>
      <h2 className="text-lg font-semibold">Start an Agentic Conversation</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Ask the agent anything. It communicates directly with your configured LLM, executes real tools, and visualizes the full ReAct loop in real-time.
      </p>
    </div>
  )
}
