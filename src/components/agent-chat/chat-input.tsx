"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { Send, Square, Gauge, Sparkles } from "lucide-react"
import { useAgentStore } from "@/store/agent-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const EXAMPLES = [
  "What's the weather in Tokyo?",
  "Calculate (15 * 23) + 47",
  "Write a Python function for Fibonacci",
  "Research how transformers work",
]

export function ChatInput() {
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendUserMessage, isRunning, speed, setSpeed } = useAgentStore()

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 160) + "px"
  }, [text])

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || isRunning) return
    sendUserMessage(trimmed)
    setText("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {/* example chips */}
        {!isRunning && text.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setText(ex)}
                className="group flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"
              >
                <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
                {ex}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40 transition">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={isRunning ? "Agent is working…" : "Ask the agent anything…"}
            disabled={isRunning}
            className="scroll-thin flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />

          {/* speed control */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-muted-foreground"
                title="Simulation speed"
              >
                <Gauge className="h-3.5 w-3.5" />
                <span className="font-mono text-[11px]">{speed}×</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuLabel>Sim speed</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[0.5, 1, 2, 4].map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={cn("justify-between font-mono", s === speed && "bg-muted")}
                >
                  {s}×
                  {s === 1 && <span className="text-[10px] text-muted-foreground">real-time</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            onClick={submit}
            disabled={!text.trim() || isRunning}
            className="h-8 gap-1.5"
          >
            {isRunning ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                Running
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send
              </>
            )}
          </Button>
        </div>

        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Press <kbd className="rounded border border-border bg-muted px-1 font-mono">Enter</kbd> to send ·
          <kbd className="ml-1 rounded border border-border bg-muted px-1 font-mono">Shift+Enter</kbd> for newline
        </p>
      </div>
    </div>
  )
}
