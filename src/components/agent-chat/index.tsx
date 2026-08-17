"use client"

import { useEffect, useRef, useState } from "react"
import { useAgentStore } from "@/store/agent-store"
import { AgentMessageView } from "./agent-message"
import { UserMessageView } from "./user-message"
import { ChatInput } from "./chat-input"
import { Sidebar } from "./sidebar"
import { AVAILABLE_MODELS } from "@/lib/agent-types"
import { Bot, PanelLeft, PanelLeftOpen, Github, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"

export function AgentChat() {
  const messages = useAgentStore((s) => s.messages)
  const isRunning = useAgentStore((s) => s.isRunning)
  const activeMessageId = useAgentStore((s) => s.activeMessageId)
  const config = useAgentStore((s) => s.config)
  const sidebarCollapsed = useAgentStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAgentStore((s) => s.toggleSidebar)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, activeMessageId, isRunning])

  const activeModel = AVAILABLE_MODELS.find((m) => m.id === config.modelId) ?? AVAILABLE_MODELS[0]

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ===== Header ===== */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* mobile: opens Sheet sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden">
              <PanelLeft className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
            <SheetTitle className="sr-only">Agent runtime panel</SheetTitle>
            <SheetDescription className="sr-only">
              ReAct loop visualization, session stats, and agent configuration
            </SheetDescription>
            <Sidebar onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* desktop: expand collapsed sidebar */}
        {sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 lg:flex"
            onClick={toggleSidebar}
            title="Expand sidebar"
          >
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
              Visualize the reasoning · acting · observing loop
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 font-mono text-[10px]" title="Active model (change in sidebar config)">
            <Zap className="h-2.5 w-2.5 text-emerald-500" />
            {activeModel.id}
          </Badge>
          <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline" title="Temperature">
            temp {config.temperature.toFixed(2)}
          </span>
          <Button variant="ghost" size="sm" className="hidden gap-1.5 text-muted-foreground sm:flex">
            <Github className="h-3.5 w-3.5" />
            Source
          </Button>
        </div>
      </header>

      {/* ===== Body ===== */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* desktop sidebar — collapsible */}
        {!sidebarCollapsed && (
          <aside className="hidden h-full w-[300px] shrink-0 overflow-hidden border-r border-border lg:block">
            <Sidebar />
          </aside>
        )}

        {/* chat column */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* messages */}
          <div
            ref={scrollRef}
            className="scroll-thin min-h-0 flex-1 overflow-y-auto"
          >
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

          {/* input */}
          <ChatInput />
        </main>
      </div>

      {/* ===== Footer ===== */}
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-background px-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Agent runtime online
        </span>
        <span className="font-mono">
          ReAct = Reason + Act + Observe · loop until answer
        </span>
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
      <h2 className="text-lg font-semibold">Start a conversation</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Ask the agent anything. You'll see it think, call tools, observe results, and loop until it
        reaches a final answer.
      </p>
    </div>
  )
}
